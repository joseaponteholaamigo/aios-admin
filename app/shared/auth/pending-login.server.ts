// El login que empezó y todavía no volvió de Cognito: `state`, el verificador de PKCE y el `nonce`.
//
// ── POR QUÉ ASÍ ────────────────────────────────────────────────────────────────────────────
//   · El verificador de PKCE es lo que impide que un código robado se canjee: no puede viajar al
//     navegador. Va cifrado en el almacén de las sesiones, bajo el hash del `state`.
//   · Una cookie `__Host-` con el `state` ata el retorno al navegador que empezó el login. Sin
//     eso, alguien podría mandarle a otra persona un retorno con SU código y meterla en SU sesión.
//   · Es de un solo uso y vive 10 minutos: un retorno repetido o viejo no entra.
import { randomBytes } from 'node:crypto';
import { hashSessionId } from '../session/session.server';
import type { SessionStore, TokenCipher } from '../session/types';

export const LOGIN_COOKIE = '__Host-panel-login';
export const LOGIN_TTL_MS = 10 * 60 * 1000;

export type PendingLogin = { verifier: string; nonce: string; returnTo: string; freshMfa: boolean };

const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';
export const loginCookie = (state: string) => `${LOGIN_COOKIE}=${state}; ${ATTRIBUTES}; Max-Age=${LOGIN_TTL_MS / 1000}`;
export const expiredLoginCookie = () => `${LOGIN_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;
const keyOf = (state: string) => `login:${hashSessionId(state)}`;
const random = () => randomBytes(32).toString('base64url');

function cookieState(request: Request): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === LOGIN_COOKIE) return rest.join('=') || null;
  }
  return null;
}

export function createPendingLogins({ store, cipher, now = Date.now }: { store: SessionStore; cipher: TokenCipher; now?: () => number }) {
  return {
    /** Guarda un login nuevo. Devuelve lo que va a Cognito y la cookie que lo ata al navegador. */
    async start({ returnTo, freshMfa }: { returnTo: string; freshMfa: boolean }) {
      const state = random();
      const pending: PendingLogin = { verifier: random(), nonce: random(), returnTo, freshMfa };
      const t = now();
      await store.put({
        idHash: keyOf(state),
        sub: '',
        sealedTokens: await cipher.seal(JSON.stringify(pending)),
        createdAt: t,
        lastActivityAt: t,
        expiresAt: Math.ceil((t + LOGIN_TTL_MS) / 1000),
      });
      return { state, pending, cookie: loginCookie(state) };
    },

    /**
     * El login que corresponde a este retorno, o `null`. Lo borra al leerlo: de un solo uso.
     * Exige que la cookie del navegador traiga el mismo `state` que el retorno.
     */
    async consume(request: Request, state: string | null): Promise<PendingLogin | null> {
      if (!state || cookieState(request) !== state) return null;
      const row = await store.get(keyOf(state));
      if (!row) return null;
      await store.delete(row.idHash);
      if (now() - row.createdAt >= LOGIN_TTL_MS) return null;
      try {
        return JSON.parse(await cipher.open(row.sealedTokens)) as PendingLogin;
      } catch {
        return null;
      }
    },
  };
}

export type PendingLogins = ReturnType<typeof createPendingLogins>;
