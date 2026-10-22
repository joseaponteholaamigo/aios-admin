// La sesión del panel, del lado del servidor (plan §3.3, decisión E).
//
// ── LO QUE PROTEGE ─────────────────────────────────────────────────────────────────────────
//   · La cookie solo lleva un id al azar. Los tokens de Cognito viven en la tabla, cifrados, y
//     la fila se guarda bajo el HASH del id: quien lea la tabla no puede usar la cookie.
//   · `__Host-`, HttpOnly, Secure, SameSite=Lax, sin Domain: ningún script la lee, no viaja por
//     http y no la ve ningún otro sitio de beenso.com.
//   · El id se rota al iniciar sesión: una cookie plantada antes del login no sirve después.
//   · 12 horas de máximo y 60 minutos sin actividad. Se deciden con las fechas de la fila, no con
//     el borrado por TTL de DynamoDB, que puede tardar días.
import { createHash, randomBytes } from 'node:crypto';
import type { SessionRecord, SessionStore, SessionTokens, TokenCipher } from './types';

export const SESSION_COOKIE = '__Host-panel-session';
export const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
/** Cada cuánto se anota la actividad, como mucho: anotarla en cada pedido sería una escritura por pedido. */
export const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;
/**
 * La cabecera con la que el panel marca un refresco automático (las pantallas que se actualizan
 * solas). Ese pedido no cuenta como actividad: si contara, la inactividad no vencería nunca.
 */
export const BACKGROUND_HEADER = 'x-panel-background';

export type ActiveSession = {
  id: string;
  sub: string;
  tokens: SessionTokens;
  record: SessionRecord;
};

export type SessionService = {
  /** Crea una sesión nueva (y borra la anterior si el pedido traía una). Devuelve su `Set-Cookie`. */
  create(request: Request, sub: string, tokens: SessionTokens): Promise<{ cookie: string; session: ActiveSession }>;
  /** La sesión vigente del pedido, o `null`. `clearCookie` dice si hay que borrar una cookie que ya no sirve. */
  read(request: Request): Promise<{ session: ActiveSession | null; clearCookie: boolean }>;
  /** Guarda tokens renovados en la misma sesión. */
  saveTokens(session: ActiveSession, tokens: SessionTokens): Promise<ActiveSession>;
  /** Cierra la sesión del pedido. Devuelve lo que tenía (para revocar el refresh token) y la cookie vencida. */
  destroy(request: Request): Promise<{ cookie: string; session: ActiveSession | null }>;
};

export const hashSessionId = (id: string) => createHash('sha256').update(id).digest('hex');

/** El id de la cookie de sesión del pedido, o `null`. */
export function sessionIdFrom(request: Request): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=') || null;
  }
  return null;
}

const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';
export const sessionCookie = (id: string) => `${SESSION_COOKIE}=${id}; ${ATTRIBUTES}`;
export const expiredSessionCookie = () => `${SESSION_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;

export function createSessionService({
  store,
  cipher,
  now = Date.now,
}: {
  store: SessionStore;
  cipher: TokenCipher;
  now?: () => number;
}): SessionService {
  const expired = (record: SessionRecord, t: number) =>
    t - record.createdAt >= MAX_SESSION_MS || t - record.lastActivityAt >= IDLE_TIMEOUT_MS;

  async function load(id: string): Promise<SessionRecord | null> {
    return store.get(hashSessionId(id));
  }

  async function open(record: SessionRecord): Promise<SessionTokens | null> {
    try {
      return JSON.parse(await cipher.open(record.sealedTokens)) as SessionTokens;
    } catch {
      return null;
    }
  }

  return {
    async create(request, sub, tokens) {
      const previous = sessionIdFrom(request);
      if (previous) await store.delete(hashSessionId(previous));
      const id = randomBytes(32).toString('base64url');
      const t = now();
      const record: SessionRecord = {
        idHash: hashSessionId(id),
        sub,
        sealedTokens: await cipher.seal(JSON.stringify(tokens)),
        createdAt: t,
        lastActivityAt: t,
        expiresAt: Math.ceil((t + MAX_SESSION_MS) / 1000),
      };
      await store.put(record);
      return { cookie: sessionCookie(id), session: { id, sub, tokens, record } };
    },

    async read(request) {
      const id = sessionIdFrom(request);
      if (!id) return { session: null, clearCookie: false };
      const record = await load(id);
      if (!record) return { session: null, clearCookie: true };
      const t = now();
      const tokens = expired(record, t) ? null : await open(record);
      if (!tokens) {
        await store.delete(record.idHash);
        return { session: null, clearCookie: true };
      }
      const background = request.headers.get(BACKGROUND_HEADER) === '1';
      if (!background && t - record.lastActivityAt >= ACTIVITY_WRITE_INTERVAL_MS) {
        record.lastActivityAt = t;
        await store.put(record);
      }
      return { session: { id, sub: record.sub, tokens, record }, clearCookie: false };
    },

    async saveTokens(session, tokens) {
      const record = { ...session.record, sealedTokens: await cipher.seal(JSON.stringify(tokens)) };
      await store.put(record);
      return { ...session, tokens, record };
    },

    async destroy(request) {
      const id = sessionIdFrom(request);
      if (!id) return { cookie: expiredSessionCookie(), session: null };
      const record = await load(id);
      const tokens = record ? await open(record) : null;
      if (record) await store.delete(record.idHash);
      return {
        cookie: expiredSessionCookie(),
        session: record && tokens ? { id, sub: record.sub, tokens, record } : null,
      };
    },
  };
}
