// La prueba rápida de después de cada despliegue (`scripts/smoke.mjs`, CA-36).
//
// EL DEFECTO QUE PREVIENE. Lambda marca una revisión «activa» aunque el servidor no arranque. Si
// la prueba rápida dijera «todo bien» con el panel roto (sin CSP, con la API abierta, con los
// formularios frenados), el despliegue se daría por bueno. Cada comprobación tiene que caer sola
// cuando lo que revisa se rompe.
import { describe, expect, test } from 'vitest';
import { runSmoke, SCREENS_OF_M2A } from '../scripts/smoke.mjs';

const PANEL = 'https://dxxxx.cloudfront.net';
const API = 'https://api.example';

type Route = () => Response;
const HEALTHY: Record<string, Route> = {
  'GET /': () => new Response(null, { status: 302, headers: { location: '/auth/login?returnTo=%2F' } }),
  'GET /auth/login': () => new Response(null, { status: 302, headers: { location: 'https://equipo.auth.example/oauth2/authorize?client_id=c&code_challenge_method=S256' } }),
  'GET /auth/no-access': () => new Response('<script type="module" src="/assets/root-AbC.js" nonce="n"></script>', {
    status: 200, headers: { 'content-security-policy': "script-src 'self' 'nonce-n'", 'cache-control': 'no-store' },
  }),
  'GET /assets/root-AbC.js': () => new Response('export {}', { status: 200 }),
  'POST /auth/logout': () => new Response(null, { status: 302, headers: { location: 'https://equipo.auth.example/logout', 'cache-control': 'no-store' } }),
  'GET /v1/admin/yo': () => new Response('{"error":"x"}', { status: 401 }),
  ...Object.fromEntries(SCREENS_OF_M2A.map((path: string) => [
    `GET ${path}`, () => new Response(null, { status: 302, headers: { location: `/auth/login?returnTo=${encodeURIComponent(path)}` } }),
  ])),
};

function fetchFor(routes: Record<string, Route>) {
  return (async (input: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? 'GET'} ${new URL(input).pathname}`];
    return route ? route() : new Response('no existe', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('runSmoke', () => {
  test('con el panel sano, todo pasa', async () => {
    const checks = await runSmoke({ panelUrl: PANEL, apiUrl: API, fetchImpl: fetchFor(HEALTHY) });
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.filter((c: { ok: boolean }) => !c.ok)).toEqual([]);
  });

  const BROKEN: [string, string, Route][] = [
    ['el servidor no arrancó', 'GET /', () => new Response('error', { status: 502 })],
    ['el login no pide PKCE', 'GET /auth/login', () => new Response(null, { status: 302, headers: { location: 'https://x/oauth2/authorize?client_id=c' } })],
    ['la página sale sin CSP', 'GET /auth/no-access', () => new Response('<script src="/assets/root-AbC.js"></script>', { status: 200, headers: { 'cache-control': 'no-store' } })],
    ['los estáticos no llegan', 'GET /assets/root-AbC.js', () => new Response('', { status: 403 })],
    ['el POST lo frena CloudFront', 'POST /auth/logout', () => new Response('', { status: 403 })],
    ['la API responde sin token', 'GET /v1/admin/yo', () => new Response('{}', { status: 200 })],
    ['una pantalla de M2a se abre sin sesión', 'GET /governance', () => new Response('<html>', { status: 200 })],
    ['una pantalla de M2a da 500', 'GET /companies/visible-aaaaaa', () => new Response('error', { status: 500 })],
  ];

  test.each(BROKEN)('⛔ cae cuando %s', async (_name, route, broken) => {
    const checks = await runSmoke({ panelUrl: PANEL, apiUrl: API, fetchImpl: fetchFor({ ...HEALTHY, [route]: broken }) });
    expect(checks.filter((c: { ok: boolean }) => !c.ok)).toHaveLength(1);
  });
});
