// La lista de Empresas desde el panel: la pestaña, el plan y el cursor de la dirección, y lo que
// dice cuando no hay nada (spec «Cuentas personales», CA-18, CA-20, CA-21 y CB-6).
//
// EL DEFECTO QUE PREVIENE. Si el loader no le pasara la pestaña al backend, Empresas volvería a
// mezclar a las 381 cuentas del webinar con los clientes reales. Si un plan inventado en la
// dirección llegara al backend, la pantalla se caería con un 422 en vez de mostrar la lista. Y si
// buscar volviera a pedir la lista, un fallo de la lista taparía el resultado de la búsqueda.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const listCompanies = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listCompanies }) }));
const { loader, shouldRevalidate } = await import('../app/modules/companies/routes/companies');
const { emptyAccountsMessage, searchSummary, originLabel } = await import('../app/modules/companies/company-labels');

const PAGE = { companies: [], next: null, onlySome: false, counts: { companies: { total: 0, plans: {} }, personal: { total: 0, plans: {} } } };

function open(url: string) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  return loader({ request: new Request(url), context, params: {} } as never);
}

beforeEach(() => {
  listCompanies.mockReset();
  listCompanies.mockResolvedValue({ kind: 'ok', value: PAGE });
});

describe('la lista de cuentas', () => {
  test('CA-18 · sin pestaña en la dirección, pide solo las empresas, sin plan ni cursor', async () => {
    await open('https://dxxxx.cloudfront.net/companies');
    expect(listCompanies).toHaveBeenCalledWith('token-ana', { kind: 'company', plan: null, cursor: null });
  });

  test('la pestaña, el plan y el cursor de la dirección llegan al backend', async () => {
    await open('https://dxxxx.cloudfront.net/companies?kind=personal&plan=custom&cursor=c2');
    expect(listCompanies).toHaveBeenCalledWith('token-ana', { kind: 'personal', plan: 'custom', cursor: 'c2' });
  });

  test('⛔ CB-6 · un plan que no existe no llega al backend: la lista sale sin filtro de plan', async () => {
    await open('https://dxxxx.cloudfront.net/companies?plan=enterprise');
    expect(listCompanies).toHaveBeenCalledWith('token-ana', { kind: 'company', plan: null, cursor: null });
  });

  test('⛔ CB-8 · el loader nunca le pasa un texto al backend, ni el `?q=` de un enlace viejo: el texto solo va por POST', async () => {
    await open('https://dxxxx.cloudfront.net/companies?kind=personal&q=maria@gmail.com&buscar=maria');
    expect(listCompanies).toHaveBeenCalledWith('token-ana', { kind: 'personal', plan: null, cursor: null });
  });

  test('buscar no vuelve a pedir la lista; cambiar de pestaña, de plan o de página sí', () => {
    const args = (formMethod: string | undefined) => ({ formMethod, defaultShouldRevalidate: true }) as never;
    expect([shouldRevalidate(args('POST')), shouldRevalidate(args(undefined))]).toEqual([false, true]);
  });
});

describe('lo que dicen la lista y la búsqueda', () => {
  test('sin cuentas, la lista dice por qué: el plan elegido, una página que se vació o que no hay', () => {
    expect(emptyAccountsMessage('company', 'pro', false)).toBe('Ninguna empresa tiene el plan Pro.');
    expect(emptyAccountsMessage('personal', 'custom', false)).toBe('Ninguna cuenta personal tiene el plan Personalizado.');
    expect(emptyAccountsMessage('personal', null, true)).toBe('En esta página no quedan cuentas personales.');
    expect(emptyAccountsMessage('company', null, false)).toBe('Todavía no hay empresas para mostrar.');
  });

  test('la búsqueda dice cuántas encontró, con qué texto y dónde lo buscó, y pide escribir más si hay más', () => {
    expect(searchSummary('personal', 'maria', null, { count: 1, hasMore: false })).toBe('1 cuenta personal con «maria» en el correo o el id.');
    expect(searchSummary('company', 'aut', 'team', { count: 2, hasMore: false })).toBe('2 empresas con «aut» en el nombre o el id, en el plan Team.');
    expect(searchSummary('company', 'zz', null, { count: 0, hasMore: false })).toBe('Ninguna empresa tiene «zz» en el nombre o el id.');
    expect(searchSummary('personal', 'gmail', null, { count: 100, hasMore: true })).toMatch(/Se muestran las primeras 100: escribe más para acotar\.$/);
  });

  test('el origen de una cuenta personal sale de si paga por Stripe', () => {
    expect(originLabel({ paysWithStripe: true } as never)).toBe('Compra en la web');
    expect(originLabel({ paysWithStripe: false } as never)).toBe('Alta del equipo');
  });
});
