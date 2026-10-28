// Lo que ve la persona cuando una pantalla de módulo no pudo cargar (CA-30 de M2a).
//
// EL DEFECTO QUE PREVIENE. Si un 403 de la API cerrara la sesión, alguien sin un módulo perdería
// todo el panel por abrir un enlace; si un 401 no la cerrara, el panel seguiría usando un token que
// el backend ya no acepta. Y si una caída del backend se viera como «esa empresa no existe», el
// equipo daría por borrada a una empresa que está ahí.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { describe, expect, test } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { fromAdminApi } from '../app/shared/api/admin-loader.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import type { AdminReadApi, ApiResult } from '../app/shared/api/admin-read-api.server';
import { ModuleError } from '../app/shared/layout/module-error';
import type { ActiveSession } from '../app/shared/session/session.server';

function setup() {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  const destroyed: string[] = [];
  const sessions = () => ({ destroy: async () => { destroyed.push('sí'); return { cookie: '__Host-panel=; Max-Age=0', session: null }; } }) as never;
  const request = new Request('https://dxxxx.cloudfront.net/companies/acme-000001');
  const run = <T>(answer: ApiResult<T> | Error) => fromAdminApi({ request, context }, async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  }, { api: () => ({}) as AdminReadApi, sessions, log: () => {} });
  return { run, destroyed };
}

/** Lo que lanzó `fromAdminApi`: el estado y el motivo, o adónde redirige. */
async function thrown(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Response) return { status: e.status, location: e.headers.get('location'), cookie: e.headers.get('set-cookie') };
    const d = e as { init?: { status?: number }; data?: { reason?: string } };
    return { status: d.init?.status, reason: d.data?.reason };
  }
  throw new Error('no lanzó nada');
}

describe('fromAdminApi', () => {
  test('con el dato, lo devuelve', async () => {
    expect(await setup().run({ kind: 'ok', value: 42 })).toBe(42);
  });

  test('no existe → 404, sin permiso → 403 y pedido inválido → 400, sin tocar la sesión', async () => {
    const { run, destroyed } = setup();
    expect(await thrown(run({ kind: 'not-found' }))).toEqual({ status: 404, reason: 'not-found' });
    expect(await thrown(run({ kind: 'forbidden' }))).toEqual({ status: 403, reason: 'forbidden' });
    expect(await thrown(run({ kind: 'invalid' }))).toEqual({ status: 400, reason: 'invalid' });
    expect(destroyed).toEqual([]);
  });

  test('⛔ la sesión que el backend ya no acepta (401) se cierra y lleva a «sin acceso», nunca al login', async () => {
    const { run, destroyed } = setup();
    const r = await thrown(run({ kind: 'unauthorized' }));
    expect(r).toMatchObject({ status: 302, location: '/auth/no-access' });
    expect(r).toHaveProperty('cookie', expect.stringContaining('Max-Age=0'));
    expect(destroyed).toEqual(['sí']);
  });

  test('⛔ el backend caído es un 503 con «volver a intentar», nunca «no existe», y la sesión sigue', async () => {
    const { run, destroyed } = setup();
    expect(await thrown(run(new AdminApiUnavailableError('caído')))).toEqual({ status: 503, reason: 'unavailable' });
    expect(await thrown(run(new ApiContractError('otra forma')))).toEqual({ status: 503, reason: 'unavailable' });
    expect(destroyed).toEqual([]);
  });
});

describe('ModuleError', () => {
  const page = (status: number) => {
    const error = { status, statusText: '', internal: false, data: {} };
    const Stub = createRoutesStub([{ path: '*', Component: () => createElement(ModuleError, { error }) }]);
    return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/companies/acme-000001?q=acme'] }));
  };

  test('cada estado dice lo que pasó, y ofrece volver a intentar o volver a la lista', () => {
    expect(page(404)).toContain('Esa empresa no existe o no está disponible');
    expect(page(404)).toContain('href="/companies"');
    expect(page(403)).toContain('No tienes acceso a esto');
    expect(page(503)).toContain('Volver a intentar');
    expect(page(503)).toContain('href="/companies/acme-000001?q=acme"');
    expect(page(403)).toContain('href="/"');
  });
});
