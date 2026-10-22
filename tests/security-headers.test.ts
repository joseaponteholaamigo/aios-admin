// Las cabeceras de seguridad (`app/middleware/security-headers.server.ts`, CA-28).
//
// EL DEFECTO QUE PREVIENE. Con un servidor intermedio, un script inyectado actúa como la persona
// que tiene la sesión. Sin CSP con nonce nada lo frena; sin `frame-ancestors 'none'` el panel se
// puede meter en un iframe ajeno para engañar clics; sin HSTS, el primer pedido puede ir por http.
import { describe, expect, test, vi } from 'vitest';
import { RouterContextProvider, type EntryContext } from 'react-router';
import { nonceContext, securityHeadersMiddleware } from '../app/middleware/security-headers.server';
import { TEST_ENV } from './helpers/fake-cognito';

async function run(response: Response, csp = true) {
  const middleware = securityHeadersMiddleware({ csp });
  const context = new RouterContextProvider();
  const args = { request: new Request('https://x/'), context, params: {} } as unknown as Parameters<typeof middleware>[0];
  const result = (await middleware(args, async () => response)) as Response;
  return { result, nonce: context.get(nonceContext) };
}

const html = () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } });

describe('securityHeadersMiddleware', () => {
  test('⛔ una página lleva CSP con el nonce del pedido, sin unsafe-inline, y no se deja enmarcar', async () => {
    const { result, nonce } = await run(html());
    const csp = result.headers.get('content-security-policy') ?? '';
    expect(nonce.length).toBeGreaterThan(10);
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  test('cada pedido tiene su propio nonce', async () => {
    const [a, b] = [await run(html()), await run(html())];
    expect(a.nonce).not.toBe(b.nonce);
  });

  test('toda respuesta lleva HSTS, Referrer-Policy y nosniff, también un redirect de solo lectura', async () => {
    const { result } = await run(Response.redirect('https://x/login', 302));
    expect(result.status).toBe(302);
    expect(result.headers.get('location')).toBe('https://x/login');
    expect(result.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(result.headers.get('referrer-policy')).toBe('no-referrer');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('en desarrollo no pone CSP, para no bloquear la recarga de Vite', async () => {
    const { result } = await run(html(), false);
    expect(result.headers.get('content-security-policy')).toBeNull();
  });
});

describe('entry.server', () => {
  test('⛔ una página que no pasó por el middleware (el 404 de una ruta que no existe) también lleva las cabeceras', async () => {
    for (const [name, value] of Object.entries(TEST_ENV)) vi.stubEnv(name, value);
    const { default: handleRequest } = await import('../app/entry.server');
    const request = new Request('https://dxxxx.cloudfront.net/no-existe', { method: 'HEAD' });
    const response = await handleRequest(request, 404, new Headers(), {} as EntryContext, new RouterContextProvider());
    expect(response.status).toBe(404);
    expect(response.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
