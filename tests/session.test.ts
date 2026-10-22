// La sesión del lado del servidor (`app/shared/session/session.server.ts`; CA-19, CA-20, CB-3,
// CB-4, CB-14).
//
// EL DEFECTO QUE PREVIENE. La sesión es la llave del panel. Si la cookie llevara los tokens, un
// script los leería; si la tabla guardara el id en claro, quien la lea entraría como cualquiera; si
// el id no rotara al entrar, una cookie plantada antes serviría después; y si la inactividad se
// midiera con el TTL de DynamoDB (que tarda días), una sesión abandonada seguiría viva.
import { beforeEach, describe, expect, test } from 'vitest';
import {
  ACTIVITY_WRITE_INTERVAL_MS, BACKGROUND_HEADER, IDLE_TIMEOUT_MS, MAX_SESSION_MS, SESSION_COOKIE,
  createSessionService, hashSessionId, type SessionService,
} from '../app/shared/session/session.server';
import { createMemorySessionStore } from '../app/shared/session/memory-store.server';
import { createLocalCipher } from '../app/shared/session/local-cipher.server';
import type { SessionStore } from '../app/shared/session/types';

const TOKENS = { accessToken: 'eyJacceso.x.y', idToken: 'eyJidentidad.x.y', refreshToken: 'refresco-123', accessTokenExpiresAt: 0 };
const MIN = 60 * 1000;

let t: number;
let store: ReturnType<typeof createMemorySessionStore>;
let service: SessionService;

beforeEach(() => {
  t = Date.UTC(2026, 9, 22, 8);
  store = createMemorySessionStore();
  service = createSessionService({ store, cipher: createLocalCipher(), now: () => t });
});

const request = (cookie?: string, headers: Record<string, string> = {}) =>
  new Request('https://dxxxx.cloudfront.net/', { headers: { ...(cookie ? { cookie } : {}), ...headers } });
const idOf = (setCookie: string) => setCookie.split(';')[0]!.split('=')[1]!;
const asCookie = (setCookie: string) => setCookie.split(';')[0]!;

async function login() {
  const { cookie } = await service.create(request(), 'sub-jose', TOKENS);
  return asCookie(cookie);
}

describe('crear', () => {
  test('⛔ la cookie es __Host-, HttpOnly, Secure, SameSite=Lax, Path=/ y sin Domain', async () => {
    const { cookie } = await service.create(request(), 'sub-jose', TOKENS);
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(cookie).toContain(attr);
    expect(cookie.toLowerCase()).not.toContain('domain=');
  });

  test('⛔ la fila se guarda bajo el hash del id, y sin los tokens en claro', async () => {
    const { cookie } = await service.create(request(), 'sub-jose', TOKENS);
    const id = idOf(cookie);
    expect(await store.get(id)).toBeNull();
    const row = await store.get(hashSessionId(id));
    expect(row?.sub).toBe('sub-jose');
    for (const secret of ['eyJ', 'refresco-123']) expect(JSON.stringify(row)).not.toContain(secret);
  });

  test('⛔ al entrar se rota el id: la cookie anterior deja de servir', async () => {
    const before = await login();
    const { cookie } = await service.create(request(before), 'sub-jose', TOKENS);
    expect(asCookie(cookie)).not.toBe(before);
    expect((await service.read(request(before))).session).toBeNull();
    expect(store.size()).toBe(1);
  });
});

describe('leer', () => {
  test('devuelve la sesión con sus tokens', async () => {
    const { session } = await service.read(request(await login()));
    expect(session?.sub).toBe('sub-jose');
    expect(session?.tokens).toEqual(TOKENS);
  });

  test('⛔ vence a las 12 horas aunque haya actividad', async () => {
    const cookie = await login();
    for (let elapsed = 30 * MIN; elapsed < MAX_SESSION_MS; elapsed += 30 * MIN) {
      t += 30 * MIN;
      expect((await service.read(request(cookie))).session, `a los ${elapsed / MIN} min`).not.toBeNull();
    }
    t += 30 * MIN;
    expect(await service.read(request(cookie))).toEqual({ session: null, clearCookie: true });
    expect(store.size()).toBe(0);
  });

  test('⛔ vence con 60 minutos sin actividad', async () => {
    const cookie = await login();
    t += IDLE_TIMEOUT_MS;
    expect(await service.read(request(cookie))).toEqual({ session: null, clearCookie: true });
  });

  test('⛔ el refresco automático no cuenta como actividad', async () => {
    const cookie = await login();
    for (let i = 0; i < 4; i++) {
      t += 15 * MIN - 1;
      await service.read(request(cookie, { [BACKGROUND_HEADER]: '1' }));
    }
    t += 4;
    expect((await service.read(request(cookie, { [BACKGROUND_HEADER]: '1' }))).session).toBeNull();
  });

  test('un pedido normal a los 59 minutos la mantiene y vuelve a contar desde ahí', async () => {
    const cookie = await login();
    t += 59 * MIN;
    expect((await service.read(request(cookie))).session).not.toBeNull();
    t += 59 * MIN;
    expect((await service.read(request(cookie))).session).not.toBeNull();
  });

  test('la actividad se anota como mucho una vez por minuto', async () => {
    const base = createMemorySessionStore();
    const writes: number[] = [];
    const counting: SessionStore = {
      get: base.get,
      delete: base.delete,
      put: async (r) => { writes.push(r.lastActivityAt); await base.put(r); },
    };
    const s = createSessionService({ store: counting, cipher: createLocalCipher(), now: () => t });
    const cookie = asCookie((await s.create(request(), 'sub-jose', TOKENS)).cookie);
    writes.length = 0;
    for (let i = 0; i < 5; i++) {
      t += 10 * 1000;
      await s.read(request(cookie));
    }
    expect(writes, 'escribió la actividad en pedidos seguidos').toEqual([]);
    t += ACTIVITY_WRITE_INTERVAL_MS;
    await s.read(request(cookie));
    expect(writes).toEqual([t]);
  });

  test('⛔ una fila vencida que DynamoDB todavía no borró se trata como vencida', async () => {
    const cookie = await login();
    const row = (await store.get(hashSessionId(idOf(cookie))))!;
    await store.put({ ...row, createdAt: t - MAX_SESSION_MS - 1, expiresAt: 0 });
    expect((await service.read(request(cookie))).session).toBeNull();
  });

  test('⛔ una cookie desconocida o unos tokens alterados no dan error: no hay sesión', async () => {
    expect(await service.read(request(`${SESSION_COOKIE}=inventado`))).toEqual({ session: null, clearCookie: true });
    const cookie = await login();
    const row = (await store.get(hashSessionId(idOf(cookie))))!;
    await store.put({ ...row, sealedTokens: `${row.sealedTokens.slice(0, -4)}AAAA` });
    expect((await service.read(request(cookie))).session).toBeNull();
  });

  test('sin cookie no hay sesión ni nada que borrar', async () => {
    expect(await service.read(request())).toEqual({ session: null, clearCookie: false });
  });
});

describe('cerrar y renovar', () => {
  test('⛔ cerrar devuelve los tokens para revocarlos, borra la fila y vence la cookie', async () => {
    const cookie = await login();
    const { cookie: expired, session } = await service.destroy(request(cookie));
    expect(session?.tokens.refreshToken).toBe('refresco-123');
    expect(expired).toContain('Max-Age=0');
    expect((await service.read(request(cookie))).session).toBeNull();
  });

  test('una pestaña que cerró la sesión la cierra para las demás', async () => {
    const cookie = await login();
    await service.destroy(request(cookie));
    expect((await service.read(request(cookie))).session).toBeNull();
  });

  test('renovar los tokens los guarda en la misma sesión', async () => {
    const cookie = await login();
    const { session } = await service.read(request(cookie));
    await service.saveTokens(session!, { ...TOKENS, accessToken: 'eyJnuevo.x.y' });
    expect((await service.read(request(cookie))).session?.tokens.accessToken).toBe('eyJnuevo.x.y');
  });
});
