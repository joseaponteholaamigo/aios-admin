// El login del equipo con el login administrado de Cognito: empezar, volver, renovar y salir
// (plan §3.3; CA-18 a CA-23).
//
// Código + PKCE + `state` + `nonce`, aunque el cliente sea confidencial. El retorno vuelve siempre
// al primer origen público (`PUBLIC_ORIGINS`), nunca al `Host` del pedido, que detrás de
// CloudFront es el del endpoint de Lambda. Los tokens nunca llegan al navegador.
import { createHash } from 'node:crypto';
import { redirect } from 'react-router';
import type { PanelConfig } from '../config/config.server';
import type { ActiveSession, SessionService } from '../session/session.server';
import { IdentityProviderError, type CognitoClient } from './cognito-client.server';
import { expiredLoginCookie, type PendingLogins } from './pending-login.server';

/** Se renueva el access token cuando le queda menos de esto. */
export const REFRESH_MARGIN_MS = 60 * 1000;

/** Una ruta del propio panel a la que volver, o `/`. Nunca otro sitio: no es una redirección abierta. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

/** La ruta que pidió el navegador. En un pedido de datos (`.data`) se quita el sufijo y la consulta interna. */
export function documentPath(url: URL): string {
  const path = url.pathname;
  if (path.endsWith('/_.data')) return path.slice(0, -'_.data'.length);
  if (path.endsWith('.data')) return path.slice(0, -'.data'.length);
  return `${path}${url.search}`;
}

/** A dónde mandar a quien no tiene sesión: al login, con la vuelta a donde estaba. */
export function loginRedirect(request: Request, { freshMfa = false, headers }: { freshMfa?: boolean; headers?: HeadersInit } = {}) {
  const params = new URLSearchParams({ returnTo: documentPath(new URL(request.url)), ...(freshMfa ? { mfa: '1' } : {}) });
  return redirect(`/auth/login?${params}`, { headers });
}

export type FinishedLogin =
  | { ok: true; response: Response }
  | { ok: false; status: number; message: string; headers: Headers };

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export function createLoginFlow({
  config,
  cognito,
  pending,
  sessions,
  now = Date.now,
  log = (message: string) => console.warn(message),
}: {
  config: PanelConfig;
  cognito: CognitoClient;
  pending: PendingLogins;
  sessions: SessionService;
  now?: () => number;
  log?: (message: string) => void;
}) {
  const origin = config.publicOrigins[0]!;
  const redirectUri = `${origin}/auth/callback`;

  function failed(status: number, message: string): FinishedLogin {
    return { ok: false, status, message, headers: new Headers({ 'Set-Cookie': expiredLoginCookie() }) };
  }

  function claimsAreValid(claims: Record<string, unknown>, nonce: string): claims is { sub: string } {
    return claims.iss === config.cognito.issuer
      && claims.aud === config.cognito.clientId
      && claims.nonce === nonce
      && typeof claims.exp === 'number' && claims.exp * 1000 > now()
      && typeof claims.sub === 'string' && claims.sub.length > 0;
  }

  return {
    async startLogin(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const freshMfa = url.searchParams.get('mfa') === '1';
      const { state, pending: login, cookie } = await pending.start({ returnTo: safeReturnTo(url.searchParams.get('returnTo')), freshMfa });
      const location = cognito.authorizeUrl({ redirectUri, state, nonce: login.nonce, codeChallenge: challengeOf(login.verifier), freshMfa });
      return redirect(location, { headers: { 'Set-Cookie': cookie } });
    },

    async finishLogin(request: Request): Promise<FinishedLogin> {
      const params = new URL(request.url).searchParams;
      if (params.get('error')) return failed(400, 'El ingreso se canceló o no se completó. Vuelve a intentarlo.');
      const login = await pending.consume(request, params.get('state'));
      const code = params.get('code');
      if (!login || !code) return failed(400, 'Este ingreso venció o no empezó en este navegador. Vuelve a intentarlo.');

      let result;
      try {
        result = await cognito.exchangeCode({ code, verifier: login.verifier, redirectUri });
      } catch (e) {
        log(`No se pudo completar el login con el proveedor de identidad: ${e instanceof IdentityProviderError ? e.reason : 'error'}`);
        return failed(502, 'No pudimos comprobar tu ingreso. Vuelve a intentarlo en un momento.');
      }
      if (!claimsAreValid(result.idClaims, login.nonce)) return failed(400, 'No pudimos verificar tu ingreso. Vuelve a intentarlo.');

      const { cookie } = await sessions.create(request, result.idClaims.sub, result.tokens);
      const headers = new Headers();
      headers.append('Set-Cookie', cookie);
      headers.append('Set-Cookie', expiredLoginCookie());
      return { ok: true, response: redirect(login.returnTo, { headers }) };
    },

    async logout(request: Request): Promise<Response> {
      const { cookie, session } = await sessions.destroy(request);
      if (session) {
        // Revocar corta el refresh token en Cognito; si falla, la sesión ya no existe de este lado.
        await cognito.revoke(session.tokens.refreshToken).catch(() => log('No se pudo revocar el refresh token al cerrar sesión'));
      }
      // Pasar por el /logout de Cognito cierra también su sesión: sin eso, volver a entrar no pediría el MFA.
      return redirect(cognito.logoutUrl(`${origin}/`), { headers: { 'Set-Cookie': cookie } });
    },

    /** La sesión con un access token vigente, renovándolo si hace falta; `null` si ya no se puede. */
    async refreshIfNeeded(session: ActiveSession): Promise<ActiveSession | null> {
      if (session.tokens.accessTokenExpiresAt - now() > REFRESH_MARGIN_MS) return session;
      try {
        return await sessions.saveTokens(session, await cognito.refresh(session.tokens.refreshToken));
      } catch {
        return null;
      }
    },
  };
}

export type LoginFlow = ReturnType<typeof createLoginFlow>;
