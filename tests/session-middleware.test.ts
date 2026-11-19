// El middleware de sesión (`app/middleware/session.server.ts`).
//
// EL DEFECTO QUE PREVIENE. Si el middleware borrara la cookie también cuando la respuesta trae
// una nueva (el retorno del login), el navegador aplicaría las dos en orden y la persona saldría
// del login sin sesión, en un bucle. Y si no la borrara cuando ya no sirve, el navegador seguiría
// mandando una cookie muerta en cada pedido.
import { beforeEach, describe, expect, test } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { sessionContext, sessionMiddleware } from '../app/middleware/session.server';
import { SESSION_COOKIE, createSessionService, type SessionService } from '../app/shared/session/session.server';
import { createMemorySessionStore } from '../app/shared/session/memory-store.server';
import { createLocalCipher } from '../app/shared/session/local-cipher.server';

const TOKENS = { accessToken: 'a', idToken: 'i', refreshToken: 'r', accessTokenExpiresAt: 0 };
let service: SessionService;
beforeEach(() => {
  service = createSessionService({ store: createMemorySessionStore(), cipher: createLocalCipher() });
});

async function run(cookie: string | undefined, response: () => Response) {
  const middleware = sessionMiddleware(() => service);
  const context = new RouterContextProvider();
  const request = new Request('https://x/', { headers: cookie ? { cookie } : {} });
  const args = { request, context, params: {} } as unknown as Parameters<typeof middleware>[0];
  const result = (await middleware(args, async () => response())) as Response;
  return { result, session: context.get(sessionContext) };
}

describe('sessionMiddleware', () => {
  test('deja la sesión del pedido en el contexto', async () => {
    const { cookie } = await service.create(new Request('https://x/'), 'sub-jose', TOKENS);
    const { session } = await run(cookie.split(';')[0], () => new Response('ok'));
    expect(session?.sub).toBe('sub-jose');
  });

  test('una cookie que ya no sirve se borra del navegador', async () => {
    const { result, session } = await run(`${SESSION_COOKIE}=muerta`, () => new Response('ok'));
    expect(session).toBeNull();
    expect(result.headers.getSetCookie()).toEqual([expect.stringContaining('Max-Age=0')]);
  });

  test('⛔ si la respuesta ya pone una cookie de sesión nueva, no se agrega la vencida', async () => {
    const nueva = `${SESSION_COOKIE}=nueva; Path=/; HttpOnly; Secure; SameSite=Lax`;
    const { result } = await run(`${SESSION_COOKIE}=muerta`, () => new Response('ok', { headers: { 'set-cookie': nueva } }));
    expect(result.headers.getSetCookie()).toEqual([nueva]);
  });
});
