// La identidad falsa de desarrollo (decisión G): imita las direcciones de Cognito que usa el panel
// (`/oauth2/authorize`, `/oauth2/token`, `/oauth2/revoke`, `/logout`) y publica su JWKS, para que el
// login de `npm run dev` recorra el mismo código que en AWS: PKCE, `state`, `nonce`, renovación y
// salida. Lo único que cambia es la pantalla: en vez de contraseña y MFA, «entrar como».
//
// Los tokens llevan lo que el backend exige a uno del pool del equipo (`client_id`, `token_use`,
// el scope `admin/acceso`, `acr` y `auth_time`), firmados con una clave que el backend local lee
// del JWKS. Solo existe en el servidor de desarrollo: ver `vite-plugin.ts` y CA-29.
import { createHash, randomBytes } from 'node:crypto';
import { MODULES, MODULE_LEVELS, type Level, type TeamMember } from '../../app/domain/permissions';
import { DevSeedError, type DevPerson } from './backend-seeder';
import { EMPTY_FORM, renderLoginPage, type LoginForm } from './login-page';
import type { TokenSigner } from './token-signer';

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_SECONDS = 60 * 60;
/** Contraseña + TOTP: el pool del equipo siempre pide MFA, así que la identidad falsa también lo dice. */
const MFA_ACR = 'urn:cognito:loa:4';
const ALLOWED_SCOPES = new Set(['openid', 'email', 'profile', 'admin/acceso']);
const CALLBACK_PATH = '/auth/callback';
const OAUTH_PARAMS = [
  'response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'nonce',
  'code_challenge', 'code_challenge_method', 'acr_values', 'max_age',
];

type Grant = { sub: string; email: string; name: string | null; scope: string; authTime: number };
type PendingCode = Grant & { nonce: string; challenge: string; redirectUri: string; expiresAt: number };

export type DevIdentityOptions = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  publicOrigins: string[];
  savePerson: (person: DevPerson) => Promise<void>;
  signer: TokenSigner;
  now?: () => number;
};

const random = () => randomBytes(32).toString('base64url');
const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');
const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const text = (body: string, status: number) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });
const oauthError = (error: string, status: number) => Response.json({ error }, { status });

/** El `sub` de una persona falsa: siempre el mismo para el mismo correo, y nunca uno de Cognito. */
export const devSub = (email: string) => `dev-${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16)}`;

/** Lo que se eligió en la pantalla. Un nivel que el módulo no admite se ignora. */
export function readForm(fields: URLSearchParams): LoginForm {
  const permissions: TeamMember['permissions'] = {};
  for (const module of MODULES) {
    const level = fields.get(`perm_${module}`) as Level | null;
    if (level && MODULE_LEVELS[module].includes(level)) permissions[module] = level;
  }
  return {
    email: (fields.get('email') ?? '').trim().toLowerCase(),
    name: (fields.get('name') ?? '').trim(),
    isSuperadmin: fields.get('superadmin') === '1',
    suspended: fields.get('suspended') === '1',
    permissions,
  };
}

export function createDevIdentity(o: DevIdentityOptions) {
  const now = o.now ?? Date.now;
  const base = new URL(o.issuer).pathname.replace(/\/+$/, '');
  const codes = new Map<string, PendingCode>();
  const refreshTokens = new Map<string, Grant>();
  const nowSeconds = () => Math.floor(now() / 1000);

  function isAllowedRedirect(value: string | null): boolean {
    try {
      const url = new URL(value ?? '');
      return o.publicOrigins.includes(url.origin) && url.pathname === CALLBACK_PATH && !url.search;
    } catch {
      return false;
    }
  }

  /** Lo que Cognito rechazaría del pedido de login, o `null`. */
  function authorizeProblem(params: URLSearchParams): string | null {
    if (params.get('response_type') !== 'code') return 'response_type tiene que ser «code»';
    if (params.get('client_id') !== o.clientId) return 'client_id desconocido';
    if (!isAllowedRedirect(params.get('redirect_uri'))) return 'redirect_uri no es el retorno del panel';
    if (params.get('code_challenge_method') !== 'S256' || !params.get('code_challenge')) return 'falta PKCE con S256';
    if (!params.get('state') || !params.get('nonce')) return 'faltan state o nonce';
    const scopes = (params.get('scope') ?? '').split(' ');
    if (!scopes.includes('openid') || scopes.some((s) => !ALLOWED_SCOPES.has(s))) return 'scope inválido';
    return null;
  }

  function issueTokens(grant: Grant, nonce?: string) {
    const iat = nowSeconds();
    const common = { sub: grant.sub, iss: o.issuer, auth_time: grant.authTime, acr: MFA_ACR, iat, exp: iat + ACCESS_TOKEN_SECONDS };
    return {
      access_token: o.signer.sign({ ...common, client_id: o.clientId, token_use: 'access', scope: grant.scope, jti: random(), username: grant.email }),
      id_token: o.signer.sign({
        ...common, aud: o.clientId, token_use: 'id', email: grant.email, email_verified: true, 'cognito:username': grant.email,
        ...(grant.name ? { name: grant.name } : {}), ...(nonce ? { nonce } : {}),
      }),
      expires_in: ACCESS_TOKEN_SECONDS,
      token_type: 'Bearer',
    };
  }

  /** El cliente se autentica con Basic, como en Cognito: `urlencode(id):urlencode(secreto)`. */
  function isClient(request: Request): boolean {
    const header = request.headers.get('authorization') ?? '';
    if (!header.startsWith('Basic ')) return false;
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    try {
      return decodeURIComponent(decoded.slice(0, separator)) === o.clientId && decodeURIComponent(decoded.slice(separator + 1)) === o.clientSecret;
    } catch {
      return false;
    }
  }

  function showLogin(params: URLSearchParams): Response {
    const problem = authorizeProblem(params);
    return problem ? text(problem, 400) : html(renderLoginPage({ params, form: EMPTY_FORM }));
  }

  async function submitLogin(fields: URLSearchParams): Promise<Response> {
    const params = new URLSearchParams(OAUTH_PARAMS.flatMap((k) => (fields.has(k) ? [[k, fields.get(k)!]] : [])));
    const problem = authorizeProblem(params);
    if (problem) return text(problem, 400);
    const form = readForm(fields);
    if (!form.email) return html(renderLoginPage({ params, form, error: 'Falta el correo.' }), 400);
    const sub = devSub(form.email);
    try {
      await o.savePerson({ sub, email: form.email, name: form.name || null, isSuperadmin: form.isSuperadmin, suspended: form.suspended, permissions: form.permissions });
    } catch (e) {
      if (!(e instanceof DevSeedError)) throw e;
      return html(renderLoginPage({ params, form, error: e.message }), 502);
    }
    const code = random();
    codes.set(code, {
      sub, email: form.email, name: form.name || null, scope: params.get('scope')!, authTime: nowSeconds(),
      nonce: params.get('nonce')!, challenge: params.get('code_challenge')!, redirectUri: params.get('redirect_uri')!,
      expiresAt: now() + CODE_TTL_MS,
    });
    const target = new URL(params.get('redirect_uri')!);
    target.searchParams.set('code', code);
    target.searchParams.set('state', params.get('state')!);
    return redirect(target.toString());
  }

  function exchangeCode(fields: URLSearchParams): Response {
    const code = fields.get('code') ?? '';
    const pending = codes.get(code);
    codes.delete(code);
    const valid = pending && pending.expiresAt > now() && pending.redirectUri === fields.get('redirect_uri')
      && pending.challenge === challengeOf(fields.get('code_verifier') ?? '');
    if (!valid) return oauthError('invalid_grant', 400);
    const { sub, email, name, scope, authTime } = pending;
    const refreshToken = random();
    refreshTokens.set(refreshToken, { sub, email, name, scope, authTime });
    return Response.json({ ...issueTokens(pending, pending.nonce), refresh_token: refreshToken });
  }

  async function token(request: Request): Promise<Response> {
    if (!isClient(request)) return oauthError('invalid_client', 401);
    const fields = new URLSearchParams(await request.text());
    if (fields.get('grant_type') === 'authorization_code') return exchangeCode(fields);
    if (fields.get('grant_type') !== 'refresh_token') return oauthError('unsupported_grant_type', 400);
    // Como Cognito: la renovación no trae refresh token nuevo y conserva el `auth_time` del login.
    const grant = refreshTokens.get(fields.get('refresh_token') ?? '');
    return grant ? Response.json(issueTokens(grant)) : oauthError('invalid_grant', 400);
  }

  async function revoke(request: Request): Promise<Response> {
    if (!isClient(request)) return oauthError('invalid_client', 401);
    refreshTokens.delete(new URLSearchParams(await request.text()).get('token') ?? '');
    return new Response(null, { status: 200 });
  }

  function logout(params: URLSearchParams): Response {
    const target = params.get('logout_uri') ?? '';
    const allowed = params.get('client_id') === o.clientId && o.publicOrigins.some((origin) => target.startsWith(`${origin}/`));
    return allowed ? redirect(target) : text('logout_uri no es del panel', 400);
  }

  /** Atiende un pedido bajo la ruta del emisor; `null` si no es suyo. */
  return async function handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null;
    switch (`${request.method} ${url.pathname.slice(base.length)}`) {
      case 'GET /.well-known/jwks.json': return Response.json(o.signer.jwks());
      case 'GET /oauth2/authorize': return showLogin(url.searchParams);
      case 'POST /oauth2/authorize': return submitLogin(new URLSearchParams(await request.text()));
      case 'POST /oauth2/token': return token(request);
      case 'POST /oauth2/revoke': return revoke(request);
      case 'GET /logout': return logout(url.searchParams);
      default: return text('Esa dirección no existe en la identidad falsa', 404);
    }
  };
}

export type DevIdentity = ReturnType<typeof createDevIdentity>;
