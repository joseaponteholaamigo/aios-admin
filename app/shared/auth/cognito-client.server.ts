// El cliente del proveedor de identidad: el login administrado de Cognito, o la identidad falsa de
// desarrollo, que imita sus mismas direcciones OIDC (`/oauth2/authorize`, `/oauth2/token`,
// `/oauth2/revoke`, `/logout`). Nunca registra códigos ni tokens.
import type { CognitoConfig } from '../config/config.server';
import type { SessionTokens } from '../session/types';

export const ADMIN_SCOPE = 'admin/acceso';
export const LOGIN_SCOPES = ['openid', 'email', 'profile', ADMIN_SCOPE];
/** Volver a pedir el MFA: contraseña + TOTP, con menos de 15 minutos (decisión E). */
export const FRESH_MFA = { acr: 'urn:cognito:loa:4', maxAgeSeconds: 900 };
const TIMEOUT_MS = 5000;

/** Cognito no respondió o respondió con error. El mensaje no lleva datos del pedido. */
export class IdentityProviderError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(`El proveedor de identidad respondió ${status} (${reason})`);
    this.name = 'IdentityProviderError';
  }
}

export type CognitoClient = {
  authorizeUrl(p: { redirectUri: string; state: string; nonce: string; codeChallenge: string; freshMfa: boolean }): string;
  logoutUrl(logoutUri: string): string;
  exchangeCode(p: { code: string; verifier: string; redirectUri: string }): Promise<{ tokens: SessionTokens; idClaims: Record<string, unknown> }>;
  refresh(refreshToken: string): Promise<SessionTokens>;
  revoke(refreshToken: string): Promise<void>;
};

/** Los claims de un JWT, sin verificar su firma. Solo para un token recibido directo del token endpoint. */
export function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) throw new IdentityProviderError(502, 'token sin forma de JWT');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function createCognitoClient({
  config,
  clientSecret,
  fetchImpl = fetch,
  now = Date.now,
}: {
  config: CognitoConfig;
  clientSecret: () => Promise<string>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): CognitoClient {
  async function post(path: string, fields: Record<string, string>): Promise<Response> {
    const secret = await clientSecret();
    const basic = Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(secret)}`).toString('base64');
    try {
      return await fetchImpl(`${config.loginUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
        body: new URLSearchParams(fields).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new IdentityProviderError(502, 'sin respuesta');
    }
  }

  async function tokenRequest(fields: Record<string, string>) {
    const r = await post('/oauth2/token', fields);
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new IdentityProviderError(r.status, typeof body.error === 'string' ? body.error : 'error');
    if (typeof body.access_token !== 'string' || typeof body.id_token !== 'string' || typeof body.expires_in !== 'number') {
      throw new IdentityProviderError(502, 'respuesta incompleta');
    }
    return body as { access_token: string; id_token: string; refresh_token?: string; expires_in: number };
  }

  return {
    authorizeUrl({ redirectUri, state, nonce, codeChallenge, freshMfa }) {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: LOGIN_SCOPES.join(' '),
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        ...(freshMfa ? { acr_values: FRESH_MFA.acr, max_age: String(FRESH_MFA.maxAgeSeconds) } : {}),
      });
      return `${config.loginUrl}/oauth2/authorize?${params}`;
    },

    logoutUrl(logoutUri) {
      return `${config.loginUrl}/logout?${new URLSearchParams({ client_id: config.clientId, logout_uri: logoutUri })}`;
    },

    async exchangeCode({ code, verifier, redirectUri }) {
      const body = await tokenRequest({ grant_type: 'authorization_code', client_id: config.clientId, code, redirect_uri: redirectUri, code_verifier: verifier });
      if (!body.refresh_token) throw new IdentityProviderError(502, 'sin refresh token');
      return {
        tokens: { accessToken: body.access_token, idToken: body.id_token, refreshToken: body.refresh_token, accessTokenExpiresAt: now() + body.expires_in * 1000 },
        idClaims: decodeJwtClaims(body.id_token),
      };
    },

    async refresh(refreshToken) {
      const body = await tokenRequest({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: refreshToken });
      return {
        accessToken: body.access_token,
        idToken: body.id_token,
        refreshToken: body.refresh_token ?? refreshToken,
        accessTokenExpiresAt: now() + body.expires_in * 1000,
      };
    },

    async revoke(refreshToken) {
      const r = await post('/oauth2/revoke', { token: refreshToken, client_id: config.clientId });
      if (!r.ok) throw new IdentityProviderError(r.status, 'no se pudo revocar');
    },
  };
}
