// Un Cognito falso para las pruebas del login: el paso de autorizar (que en la vida real hace la
// persona en la pantalla de Cognito) y los endpoints de tokens y revocación, con las mismas
// comprobaciones que el real: PKCE, `redirect_uri` y la autenticación del cliente.
import { createHash, randomBytes } from 'node:crypto';
import { readConfig, type PanelConfig } from '../../app/shared/config/config.server';

export const ORIGIN = 'https://dxxxx.cloudfront.net';
export const LOGIN_URL = 'https://equipo.auth.us-east-2.amazoncognito.com';
export const ISSUER = 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_equipo';
export const CLIENT_ID = 'cliente-del-panel';
export const CLIENT_SECRET = 'secreto-del-panel';

/** Un entorno completo y válido, como el que lee el servidor del panel. */
export const TEST_ENV = {
  PUBLIC_ORIGINS: ORIGIN,
  SESSION_STORE: 'memory',
  COGNITO_LOGIN_URL: LOGIN_URL,
  COGNITO_ISSUER: ISSUER,
  COGNITO_CLIENT_ID: CLIENT_ID,
  COGNITO_CLIENT_SECRET: CLIENT_SECRET,
  ADMIN_API_URL: 'https://api.example',
};

export const testConfig = (): PanelConfig => readConfig(TEST_ENV);

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims: Record<string, unknown>) => `${b64({ alg: 'RS256', kid: 'k' })}.${b64(claims)}.firma`;

export function fakeCognito({ now = () => Date.now() } = {}) {
  const codes = new Map<string, { sub: string; nonce: string; challenge: string; redirectUri: string }>();
  const refreshTokens = new Map<string, string>();
  const revoked: string[] = [];
  let down = false;
  let nonceOverride: string | null = null;
  let refreshes = 0;

  const tokensFor = (sub: string, nonce?: string) => {
    const seconds = Math.floor(now() / 1000);
    return {
      access_token: jwt({ sub, token_use: 'access', client_id: CLIENT_ID, scope: 'openid admin/acceso', exp: seconds + 900 }),
      id_token: jwt({ sub, iss: ISSUER, aud: CLIENT_ID, token_use: 'id', exp: seconds + 900, ...(nonce ? { nonce } : {}) }),
      expires_in: 900,
      token_type: 'Bearer',
    };
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (down) throw new TypeError('fetch failed');
    const url = new URL(String(input));
    const fields = new URLSearchParams(String(init?.body ?? ''));
    const auth = new Headers(init?.headers).get('authorization');
    const expected = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
    if (auth !== expected) return Response.json({ error: 'invalid_client' }, { status: 401 });

    if (url.pathname === '/oauth2/revoke') {
      revoked.push(fields.get('token') ?? '');
      return new Response(null, { status: 200 });
    }
    if (fields.get('grant_type') === 'authorization_code') {
      const grant = codes.get(fields.get('code') ?? '');
      codes.delete(fields.get('code') ?? '');
      const challenge = createHash('sha256').update(fields.get('code_verifier') ?? '').digest('base64url');
      if (!grant || grant.challenge !== challenge || grant.redirectUri !== fields.get('redirect_uri')) {
        return Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
      const refresh = randomBytes(16).toString('hex');
      refreshTokens.set(refresh, grant.sub);
      return Response.json({ ...tokensFor(grant.sub, nonceOverride ?? grant.nonce), refresh_token: refresh });
    }
    if (fields.get('grant_type') === 'refresh_token') {
      refreshes += 1;
      const token = fields.get('refresh_token') ?? '';
      const sub = refreshTokens.get(token);
      if (!sub || revoked.includes(token)) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      return Response.json(tokensFor(sub));
    }
    return Response.json({ error: 'unsupported' }, { status: 400 });
  }) as typeof fetch;

  return {
    fetchImpl,
    /** Lo que hace la persona en la pantalla de Cognito: a partir del enlace de autorizar, da un código. */
    authorize(authorizeUrl: string, sub = 'sub-jose') {
      const p = new URL(authorizeUrl).searchParams;
      const code = randomBytes(8).toString('hex');
      codes.set(code, { sub, nonce: p.get('nonce') ?? '', challenge: p.get('code_challenge') ?? '', redirectUri: p.get('redirect_uri') ?? '' });
      return { code, state: p.get('state') ?? '' };
    },
    revoked,
    refreshes: () => refreshes,
    setDown(value: boolean) { down = value; },
    setNonce(value: string | null) { nonceOverride = value; },
  };
}
