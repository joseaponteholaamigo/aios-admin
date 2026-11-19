// El paso entre las páginas de la lista por cursor (spec «Registro abierto» de aios-tower, CA-24) y su
// bloqueo mientras carga (regla «Front-end interaction» del CLAUDE.md global).
//
// EL DEFECTO QUE PREVIENE. Si «Siguiente» no llevara el cursor que dio el backend, repetiría la misma
// página o saltaría cuentas. Si en la última página siguiera llevando a alguna parte, pediría una página
// que no existe. Y si se pudiera oprimir otra vez mientras carga, la persona no sabría si el clic llegó y
// mandaría otro pedido.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';

type NavigationLike = { state: string; location?: { pathname: string; search: string } };
const navigation = vi.hoisted(() => ({ current: { state: 'idle' } as NavigationLike }));
vi.mock('react-router', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router')>()), useNavigation: () => navigation.current }));
const { CursorPager } = await import('../app/modules/companies/components/cursor-pager');

const FIRST = '/companies?kind=personal';
const NEXT = '/companies?kind=personal&after=MjAyNi0xMS0xM1QxNTowMDowMC4wMDBaI3JlZ2lzdHJvLWExYjJjMw';

function pager(firstHref: string | null, nextHref: string | null) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(CursorPager, { summary: '50 cuentas personales en esta página', firstHref, nextHref }) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [FIRST] }));
}

/** Los pasos: su texto, a dónde llevan (o `null`) y si están desactivados u ocupados. */
const steps = (html: string) => [...html.matchAll(/<a ([^>]*)>(?:<span[^>]*><\/span>)?([^<]+)<\/a>/g)].map((m) => ({
  text: m[2],
  href: /href="([^"]+)"/.exec(m[1] ?? '')?.[1]?.replaceAll('&amp;', '&') ?? null,
  disabled: (m[1] ?? '').includes('aria-disabled="true"'),
  busy: (m[1] ?? '').includes('aria-busy="true"'),
}));

afterEach(() => { navigation.current = { state: 'idle' }; });

describe('el paso entre páginas', () => {
  test('⛔ en la primera página, solo «Siguiente», con el cursor que dio el backend', () => {
    expect(steps(pager(null, NEXT))).toEqual([{ text: 'Siguiente', href: NEXT, disabled: false, busy: false }]);
  });

  test('después de la primera, también «Primera página», que lleva a las más nuevas', () => {
    expect(steps(pager(FIRST, NEXT)).map((s) => [s.text, s.href])).toEqual([['Primera página', FIRST], ['Siguiente', NEXT]]);
  });

  test('⛔ en la última, «Siguiente» no lleva a ninguna parte', () => {
    expect(steps(pager(FIRST, null))[1]).toEqual({ text: 'Siguiente', href: null, disabled: true, busy: false });
  });

  test('con una sola página no hay pasos, solo lo que muestra', () => {
    const html = pager(null, null);
    expect(steps(html)).toEqual([]);
    expect(html).toContain('50 cuentas personales en esta página');
  });

  test('⛔ mientras carga la siguiente, los dos pasos se bloquean y el oprimido dice «Cargando…»', () => {
    const [pathname, search] = NEXT.split('?') as [string, string];
    navigation.current = { state: 'loading', location: { pathname, search: `?${search}` } };
    expect(steps(pager(FIRST, NEXT))).toEqual([
      { text: 'Primera página', href: null, disabled: true, busy: false },
      { text: 'Cargando…', href: null, disabled: true, busy: true },
    ]);
  });

  test('cargar otra pantalla no los bloquea: solo un pedido de este paginador', () => {
    navigation.current = { state: 'loading', location: { pathname: '/companies/registro-a1b2c3', search: '' } };
    expect(steps(pager(FIRST, NEXT)).map((s) => s.disabled)).toEqual([false, false]);
  });
});
