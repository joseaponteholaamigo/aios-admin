// La protección CSRF (`app/middleware/csrf.server.ts`, CA-27).
//
// EL DEFECTO QUE PREVIENE. Sin ella, una página ajena abierta en otra pestaña podría mandar un
// formulario al panel y la cookie de la sesión iría sola: el superadministrador revocaría a un
// cliente sin saberlo. Y si se comparara contra el `Host` del pedido, detrás de CloudFront se
// rechazaría todo (el Host es el del endpoint de Lambda) o se aceptaría lo que no es.
import { describe, expect, test } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { csrfMiddleware, isAllowedRequest } from '../app/middleware/csrf.server';

const ORIGINS = ['https://dxxxx.cloudfront.net'];
const LAMBDA_HOST = 'abcd.b7t.lambda-web.us-east-2.on.aws';

const post = (headers: Record<string, string>) =>
  new Request(`https://${LAMBDA_HOST}/empresas`, { method: 'POST', headers: { host: LAMBDA_HOST, ...headers } });

describe('isAllowedRequest', () => {
  test('acepta el origen del panel aunque el Host sea el del endpoint de Lambda', () => {
    expect(isAllowedRequest(post({ origin: 'https://dxxxx.cloudfront.net' }), ORIGINS)).toBe(true);
  });

  test('⛔ rechaza otro origen, y la falta de origen sin Sec-Fetch-Site same-origin', () => {
    expect(isAllowedRequest(post({ origin: 'https://evil.example' }), ORIGINS)).toBe(false);
    expect(isAllowedRequest(post({ origin: `https://${LAMBDA_HOST}` }), ORIGINS)).toBe(false);
    expect(isAllowedRequest(post({}), ORIGINS)).toBe(false);
    expect(isAllowedRequest(post({ 'sec-fetch-site': 'cross-site' }), ORIGINS)).toBe(false);
  });

  test('sin Origin, acepta Sec-Fetch-Site same-origin', () => {
    expect(isAllowedRequest(post({ 'sec-fetch-site': 'same-origin' }), ORIGINS)).toBe(true);
  });

  test('los pedidos que no cambian nada pasan sin revisar', () => {
    expect(isAllowedRequest(new Request('https://x/empresas', { headers: { origin: 'https://evil.example' } }), ORIGINS)).toBe(true);
  });
});

describe('csrfMiddleware', () => {
  const run = (request: Request) => {
    const middleware = csrfMiddleware(() => ORIGINS);
    let nextCalled = false;
    const args = { request, context: new RouterContextProvider(), params: {} } as unknown as Parameters<typeof middleware>[0];
    const result = middleware(args, async () => { nextCalled = true; return new Response('ok'); });
    return { result, nextCalled: () => nextCalled };
  };

  test('⛔ corta con 403 antes de llegar a la action', async () => {
    const { result, nextCalled } = run(post({ origin: 'https://evil.example' }));
    await expect(Promise.resolve().then(() => result)).rejects.toMatchObject({ status: 403 });
    expect(nextCalled()).toBe(false);
  });

  test('deja seguir un pedido del panel', async () => {
    const { result, nextCalled } = run(post({ origin: 'https://dxxxx.cloudfront.net' }));
    await result;
    expect(nextCalled()).toBe(true);
  });
});
