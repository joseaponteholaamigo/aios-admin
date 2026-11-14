// La pestaña de cuentas personales por el índice de cuentas (spec «Registro abierto» de aios-tower, RP1:
// CA-23 y CA-24): de dónde salió cada cuenta, cuántas hay de cada origen, una página por cursor y lo que
// dice cuando el índice no trae nada.
//
// EL DEFECTO QUE PREVIENE. Con el registro abierto, la pestaña pasa de cientos a miles de cuentas Free. Si
// el panel siguiera pidiendo la lista vieja, cada página recorrería todas las cuentas y la pantalla se
// volvería lenta justo cuando más se usa. Si la columna Origen siguiera deduciendo el origen del pago por
// Stripe, una cuenta del registro que compró Pro diría «Compra en la web». Si un enlace con un cursor que el
// backend ya no entiende diera la pantalla de error, el equipo se quedaría sin lista. Y si la lista vacía
// antes del relleno del índice dijera «no hay cuentas personales», el equipo creería que no existen.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AccountOrigin, Company, IndexCounts, OriginCount, PersonalAccountsPage } from '../app/domain/companies';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { CompanyTabs } from '../app/modules/companies/components/company-tabs';
import { OriginCounts } from '../app/modules/companies/components/origin-counts';
import { PersonalAccountsList } from '../app/modules/companies/components/personal-accounts-list';
import { PersonalAccountsTable } from '../app/modules/companies/components/personal-accounts-table';
import { cursorResetHref, cursorResetNotice } from '../app/modules/companies/personal-accounts-labels';

const listCompanies = vi.fn();
const listPersonalAccounts = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listCompanies, listPersonalAccounts }) }));
const { loader, default: CompaniesPage } = await import('../app/modules/companies/routes/companies');

const CURSOR = Buffer.from('2026-11-13T15:00:00.000Z#registro-a1b2c3').toString('base64url');

const porOrigen = (signup: number, code: number, purchase: number, webinar: number, team: number): OriginCount['byOrigin'] => ({ signup, code, purchase, webinar, team });
const COUNTS: IndexCounts = {
  companies: { total: 12, byOrigin: porOrigen(0, 0, 3, 0, 9) },
  personal: { total: 5012, byOrigin: porOrigen(4300, 200, 80, 381, 51) },
};
const NONE: IndexCounts = { companies: { total: 0, byOrigin: porOrigen(0, 0, 0, 0, 0) }, personal: { total: 0, byOrigin: porOrigen(0, 0, 0, 0, 0) } };

const cuenta = (id: string, origin: AccountOrigin | null, extra: Partial<Company> = {}): Company => ({
  id, name: id, kind: 'personal', person: { email: `${id}@gmail.com`, status: 'active', invitedAt: null, acceptedAt: null }, origin,
  plan: 'free', status: 'active', expiry: { expired: false, expiredBy: null, until: null }, notice: null, seats: { used: 1, cap: 1 }, admins: 1,
  paysWithStripe: false, createdAt: '2026-11-13T15:00:00.000Z', ...extra,
});

const PAGE: PersonalAccountsPage = { accounts: [cuenta('registro-a1b2c3', 'signup')], next: CURSOR, counts: COUNTS, onlySome: false };

function open(url: string) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  return loader({ request: new Request(url), context, params: {} } as never);
}

/** Lo que lanzó el loader: adónde redirige, o el estado y el motivo de la pantalla de error. */
async function thrown(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Response) return { status: e.status, location: e.headers.get('location') };
    const d = e as { init?: { status?: number }; data?: { reason?: string } };
    return { status: d.init?.status, reason: d.data?.reason };
  }
  throw new Error('no lanzó nada');
}

/** Renderiza dentro de un router, porque la lista lleva enlaces y la búsqueda un fetcher. */
function render<P extends object>(Component: ComponentType<P>, props: P, at = '/companies?kind=personal') {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

const IDLE = { text: '', setText: () => {}, state: { kind: 'idle' as const } };
const list = (extra: Partial<PersonalAccountsPage & { after: string | null }> = {}) =>
  render(PersonalAccountsList, { list: { ...PAGE, after: null, ...extra }, search: IDLE, notice: null });

beforeEach(() => {
  listCompanies.mockReset();
  listPersonalAccounts.mockReset();
  listPersonalAccounts.mockResolvedValue({ kind: 'ok', value: PAGE });
});

describe('lo que pide la pestaña (CA-24)', () => {
  test('⛔ pide una sola página al índice, la primera sin cursor, y nunca la lista vieja que recorre todas las cuentas', async () => {
    const data = await open('https://dxxxx.cloudfront.net/companies?kind=personal');
    expect(listPersonalAccounts.mock.calls).toEqual([['token-ana', { after: null }]]);
    expect(listCompanies).not.toHaveBeenCalled();
    expect(data).toMatchObject({ tab: 'personal', after: null, next: CURSOR });
  });

  test('un enlace de antes, con plan y número de página, abre la primera página del índice sin pasárselos', async () => {
    // EL DEFECTO: la lista por el índice responde 422 a un `plan` o a una `pagina`, y los enlaces guardados del equipo los traen.
    await open('https://dxxxx.cloudfront.net/companies?kind=personal&plan=pro&page=3');
    expect(listPersonalAccounts.mock.calls).toEqual([['token-ana', { after: null }]]);
  });

  test('con el cursor de la dirección, pide la página que sigue a ese cursor', async () => {
    const data = await open(`https://dxxxx.cloudfront.net/companies?kind=personal&after=${CURSOR}`);
    expect(listPersonalAccounts.mock.calls).toEqual([['token-ana', { after: CURSOR }]]);
    expect(data).toMatchObject({ after: CURSOR });
  });

  test('⛔ un cursor que el backend no entiende (422) vuelve a la primera página con el aviso, no a la pantalla de error', async () => {
    listPersonalAccounts.mockResolvedValue({ kind: 'invalid' });
    expect(await thrown(open(`https://dxxxx.cloudfront.net/companies?kind=personal&after=${CURSOR}`))).toEqual({ status: 302, location: cursorResetHref() });
    expect(cursorResetHref()).toBe('/companies?kind=personal&aviso=cursor');
  });

  test('un cursor sin la forma de uno no llega al backend: vuelve a la primera página con el aviso', async () => {
    expect(await thrown(open('https://dxxxx.cloudfront.net/companies?kind=personal&after=no%20es%20un%20cursor!'))).toEqual({ status: 302, location: cursorResetHref() });
    expect(listPersonalAccounts).not.toHaveBeenCalled();
  });

  test('⛔ sin cursor, un 422 no redirige a la misma página: daría vueltas sin fin', async () => {
    listPersonalAccounts.mockResolvedValue({ kind: 'invalid' });
    expect(await thrown(open('https://dxxxx.cloudfront.net/companies?kind=personal'))).toEqual({ status: 400, reason: 'invalid' });
  });
});

describe('de dónde salió cada cuenta (CA-23)', () => {
  test('⛔ la columna Origen dice el origen que anotó el backend, no si la cuenta paga por Stripe', () => {
    // Una cuenta del registro que después compró Pro paga por Stripe y sigue siendo del registro.
    const accounts = [cuenta('a-000001', 'signup', { paysWithStripe: true }), cuenta('b-000002', 'code'), cuenta('c-000003', 'purchase'), cuenta('d-000004', 'webinar'), cuenta('e-000005', 'team')];
    const html = render(PersonalAccountsTable, { accounts, emptyMessage: '' });
    expect([...html.matchAll(/<span class="chip">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(['Registro', 'Código', 'Compra en la web', 'Webinar', 'Alta del equipo']);
  });

  test('una cuenta cuyo origen el panel no conoce dice «Sin dato», no otro origen', () => {
    expect(render(PersonalAccountsTable, { accounts: [cuenta('a-000001', null)], emptyMessage: '' })).toContain('<span class="chip">Sin dato</span>');
  });
});

describe('los números por origen (CA-24)', () => {
  test('⛔ arriba de la lista dice cuántas cuentas hay de cada origen, con punto de miles', () => {
    const html = render(OriginCounts, { counts: COUNTS.personal, onlySome: false });
    expect([...html.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map((m) => [m[1], m[2]])).toEqual([
      ['Registro', '4.300'], ['Código', '200'], ['Compra en la web', '80'], ['Webinar', '381'], ['Alta del equipo', '51'],
    ]);
  });

  test('⛔ con el filtro de empresas visibles, dice que los números cuentan solo esas cuentas; sin el filtro, no lo dice', () => {
    expect(render(OriginCounts, { counts: COUNTS.personal, onlySome: true })).toContain('cuentan solo las cuentas visibles para el panel');
    expect(render(OriginCounts, { counts: COUNTS.personal, onlySome: false })).not.toContain('cuentas visibles');
  });

  test('las pestañas cuentan con los números del índice, con punto de miles', () => {
    const html = render(CompanyTabs, { kind: 'personal', counts: COUNTS });
    expect([...html.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1])).toEqual(['Empresas (12)', 'Cuentas personales (5.012)']);
  });
});

describe('la lista vacía', () => {
  test('⛔ en la primera página no afirma que no haya cuentas: dice que la lista sale de un índice y cómo se llena', () => {
    const html = list({ accounts: [], next: null, counts: NONE });
    expect(html).toContain('eso no prueba que no haya');
    expect(html).toContain('npm run rellenar-indice-de-cuentas');
    expect(html).not.toMatch(/Todavía no hay|No hay cuentas/);
    // Sin cuentas no hay números que repartir ni páginas que pasar.
    expect(html).not.toContain('origin-counts');
    expect(html).not.toContain('class="pag"');
  });

  test('con el filtro de empresas visibles sí es cierta, y lo dice así: la lista sale de esas cuentas, no del índice', () => {
    expect(list({ accounts: [], next: null, counts: NONE, onlySome: true })).toContain('Ninguna de las cuentas visibles para el panel es una cuenta personal.');
  });

  test('una página después de la primera sin cuentas lo dice, y ofrece volver a la primera', () => {
    const html = list({ accounts: [], next: null, after: CURSOR });
    expect(html).toContain('Esta página no trae ninguna cuenta.');
    expect(html).toMatch(/<a[^>]*href="\/companies\?kind=personal"[^>]*>Primera página<\/a>/);
  });
});

describe('la pantalla de la pestaña', () => {
  const page = (extra: Record<string, unknown> = {}) =>
    render(CompaniesPage as ComponentType<object>, { loaderData: { tab: 'personal', ...PAGE, after: null, pendingDeletions: [], canCreate: false, ...extra } });

  test('⛔ no ofrece filtro de plan: la lista por el índice no filtra por plan, y uno que no filtra haría creer que filtró', () => {
    const html = page();
    expect(html).not.toContain('name="plan"');
    expect(html).toContain('placeholder="Buscar por correo"');
  });

  test('la cuenta, sus números por origen y el paso a la página siguiente con el cursor que dio el backend', () => {
    const html = page();
    expect(html).toContain('registro-a1b2c3@gmail.com');
    expect(html).toContain('aria-label="Cuentas personales por origen"');
    expect(html).toContain(`href="/companies?kind=personal&amp;after=${CURSOR}"`);
  });

  test('⛔ al volver por un enlace de página que no sirvió, lo dice', () => {
    expect(cursorResetNotice(new URLSearchParams({ kind: 'personal', aviso: 'cursor' }))).toBe('Ese enlace a una página de la lista ya no sirve: te mostramos la primera.');
    expect(cursorResetNotice(new URLSearchParams({ kind: 'personal', aviso: 'otra-cosa' }))).toBeNull();
    const html = render(CompaniesPage as ComponentType<object>, { loaderData: { tab: 'personal', ...PAGE, after: null, pendingDeletions: [], canCreate: false } }, '/companies?kind=personal&aviso=cursor');
    expect(html).toMatch(/<div class="banner info" role="status">[\s\S]*Ese enlace a una página de la lista ya no sirve/);
  });
});
