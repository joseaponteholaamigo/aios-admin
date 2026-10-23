// El middleware de acceso (`app/middleware/auth.server.ts`).
//
// EL DEFECTO QUE PREVIENE. Si una ruta del panel respondiera sin sesión, sus datos quedarían a la
// vista de cualquiera; si el login mismo pidiera sesión, nadie podría entrar; y si un refresh
// token revocado no cerrara la sesión, quien fue dado de baja seguiría adentro hasta las 12 horas.
import { describe, expect, test } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { authMiddleware } from '../app/middleware/auth.server';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession, SessionService } from '../app/shared/session/session.server';
import type { LoginFlow } from '../app/shared/auth/login-flow.server';
import { IdentityProviderError } from '../app/shared/auth/cognito-client.server';

const SESSION = { id: 'id', sub: 'sub-jose', tokens: {}, record: {} } as unknown as ActiveSession;

let destroyed = 0;

async function run(
  path: string,
  { session = null as ActiveSession | null, refreshed = SESSION as ActiveSession | null, failsWith = null as unknown } = {},
) {
  destroyed = 0;
  const flow = { refreshIfNeeded: async () => { if (failsWith) throw failsWith; return refreshed; } } as unknown as LoginFlow;
  const sessions = { destroy: async () => { destroyed += 1; return { cookie: 'muerta=; Max-Age=0', session: null }; } } as unknown as SessionService;
  const middleware = authMiddleware(() => flow, () => sessions);
  const context = new RouterContextProvider();
  context.set(sessionContext, session);
  let reached = false;
  const args = { request: new Request(`https://x${path}`), context, params: {} } as unknown as Parameters<typeof middleware>[0];
  try {
    await middleware(args, async () => { reached = true; return new Response('ok'); });
    return { reached, thrown: null as Response | null, context };
  } catch (e) {
    return { reached, thrown: e as Response, context };
  }
}

describe('authMiddleware', () => {
  test('⛔ sin sesión manda al login con la vuelta, también en un pedido de datos', async () => {
    const page = await run('/empresas?filtro=activas');
    expect(page.reached).toBe(false);
    expect(page.thrown?.headers.get('location')).toBe('/auth/login?returnTo=%2Fempresas%3Ffiltro%3Dactivas');
    const dataRequest = await run('/empresas.data');
    expect(dataRequest.thrown?.headers.get('location')).toBe('/auth/login?returnTo=%2Fempresas');
  });

  test('el login y «sin acceso» no piden sesión', async () => {
    for (const path of ['/auth/login', '/auth/callback?code=x', '/auth/logout', '/auth/no-access']) {
      expect((await run(path)).reached, path).toBe(true);
    }
  });

  test('⛔ una dirección inventada bajo /auth/ sí pide sesión: lo público lo dice la tabla', async () => {
    expect((await run('/auth/inventada')).thrown?.headers.get('location')).toContain('/auth/login');
  });

  test('con sesión pasa, con los tokens renovados en el contexto', async () => {
    const refreshed = { ...SESSION, id: 'renovada' } as ActiveSession;
    const r = await run('/', { session: SESSION, refreshed });
    expect(r.reached).toBe(true);
    expect(r.context.get(sessionContext)?.id).toBe('renovada');
  });

  test('si Cognito no responde al renovar, responde 503 y no cierra la sesión', async () => {
    const r = await run('/', { session: SESSION, failsWith: new IdentityProviderError(502, 'sin respuesta') });
    expect(r.reached).toBe(false);
    expect((r.thrown as unknown as { init?: { status?: number } })?.init?.status).toBe(503);
    expect(destroyed).toBe(0);
  });

  test('⛔ si ya no se pueden renovar los tokens, cierra la sesión y manda al login', async () => {
    const r = await run('/', { session: SESSION, refreshed: null });
    expect(r.reached).toBe(false);
    expect(r.thrown?.headers.get('location')).toContain('/auth/login');
    expect(r.thrown?.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
