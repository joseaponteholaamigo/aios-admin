// La búsqueda de Empresas desde el panel (spec «Cuentas personales», CA-19).
//
// EL DEFECTO QUE PREVIENE. Lo que se escribe a mano viene con mayúsculas y espacios: si el panel lo
// mandara así, no encontraría a nadie. Si la respuesta no dijera con qué texto, pestaña y plan
// buscó, la pantalla mostraría el resultado de una búsqueda vieja como si fuera el de la nueva. Y lo
// que no se puede buscar no tiene que llegar al backend.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const searchCompanies = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ searchCompanies }) }));
const { action } = await import('../app/modules/companies/routes/companies');
const { searchScope } = await import('../app/shared/search/use-background-search');

const FOUND = { companies: [], hasMore: false, onlySome: false };
const NOTHING = { companies: [], hasMore: false, onlySome: true };

function search(fields: Record<string, string>, url = 'https://dxxxx.cloudfront.net/companies?kind=personal') {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  const request = new Request(url, { method: 'POST', body: new URLSearchParams(fields) });
  return action({ request, context, params: {} } as never);
}

beforeEach(() => {
  searchCompanies.mockReset();
  searchCompanies.mockResolvedValue({ kind: 'ok', value: FOUND });
});

describe('buscar cuentas', () => {
  test('manda el texto sin espacios y en minúsculas, con la pestaña y el plan, y devuelve qué buscó', async () => {
    const r = await search({ text: '  Maria@GMAIL ', kind: 'personal', plan: 'custom' });
    expect(searchCompanies).toHaveBeenCalledWith('token-ana', { text: 'maria@gmail', kind: 'personal', plan: 'custom' });
    expect(r).toEqual({ text: 'maria@gmail', scope: searchScope({ kind: 'personal', plan: 'custom' }), result: FOUND });
  });

  test('sin plan, busca en todos', async () => {
    await search({ text: 'auteco', kind: 'company', plan: '' });
    expect(searchCompanies).toHaveBeenCalledWith('token-ana', { text: 'auteco', kind: 'company', plan: null });
  });

  test('⛔ sin texto, con uno más largo que un correo, o con una pestaña o un plan que no existen, no llega al backend', async () => {
    for (const malo of [
      { text: '   ', kind: 'company', plan: '' }, { text: 'a'.repeat(255), kind: 'company', plan: '' },
      { text: 'ana', kind: 'otra', plan: '' }, { text: 'ana', kind: 'company', plan: 'enterprise' },
    ]) {
      expect((await search(malo)).result, JSON.stringify(malo).slice(0, 40)).toEqual(NOTHING);
    }
    expect(searchCompanies).not.toHaveBeenCalled();
  });
});
