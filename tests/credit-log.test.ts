// La bitácora de créditos en Consumo (spec «Créditos por persona» de aios-tower, CA-27 a CA-32, CB-14).
//
// EL DEFECTO QUE PREVIENE. Que un filtro se pierda o se cambie camino al backend; que el correo de una
// persona termine en la dirección; que una fila no diga qué fue ni de dónde salió; y que la lista vacía
// quede en blanco en vez de ofrecer quitar los filtros.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CreditLogRow } from '../app/domain/credits';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { NO_FILTERS, readCreditLogFilters } from '../app/modules/usage/credit-log-form-data';
import { CreditLogTable } from '../app/modules/usage/components/credit-log-table';
import { Pager } from '../app/shared/ui/pager';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';

const listCreditLog = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listCreditLog }) }));
const { action, loader } = await import('../app/modules/usage/routes/usage');

const member: TeamMember = { actor: 'equipo:sub', email: null, name: null, isSuperadmin: false, status: 'active', permissions: { usage: 'view' } };
const PAGINA_VACIA = { rows: [], page: { page: 1, pages: 1, total: 0, perPage: 50 } };

function contexto() {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub', tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

const formOf = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const render = (element: ReturnType<typeof createElement>) => {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/usage'] }));
};

beforeEach(() => listCreditLog.mockReset());

describe('los filtros', () => {
  test('lo vacío es «sin ese filtro», y lo puesto llega normalizado', () => {
    expect(readCreditLogFilters(formOf({}))).toEqual({ filters: NO_FILTERS });
    expect(readCreditLogFilters(formOf({ company: 'auteco-4d5e6f', email: ' Luis@Auteco.com ', module: 'video', kind: 'spend', from: '2026-11-01', to: '2026-11-30', page: '3' }))).toEqual({
      filters: { company: 'auteco-4d5e6f', email: 'luis@auteco.com', module: 'video', kind: 'spend', from: '2026-11-01', to: '2026-11-30', page: 3 },
    });
  });

  test('un filtro roto se dice junto a su campo: correo, fechas al revés, más de 12 meses, un tipo inventado', () => {
    const errores = (fields: Record<string, string>) => {
      const r = readCreditLogFilters(formOf(fields));
      return 'errors' in r ? Object.keys(r.errors) : [];
    };
    expect(errores({ email: 'luis' })).toEqual(['email']);
    expect(errores({ from: '2026-11-30', to: '2026-11-01' })).toEqual(['to']);
    expect(errores({ from: '2025-01-01', to: '2026-11-30' })).toEqual(['to']);
    expect(errores({ kind: 'regalo', module: 'imagenes' }).sort()).toEqual(['kind', 'module']);
    expect(errores({ company: 'Auteco SAS' })).toEqual(['company']);
  });
});

describe('la pantalla', () => {
  test('⛔ sin filtros pide el mes en curso; con filtros, los manda tal cual, y uno roto no llama a la API (CA-30)', async () => {
    listCreditLog.mockResolvedValue({ kind: 'ok', value: PAGINA_VACIA });
    await loader({ request: new Request('https://dxxxx.cloudfront.net/usage'), context: contexto(), params: {} } as never);
    expect(listCreditLog).toHaveBeenLastCalledWith('token', NO_FILTERS);
    const post = (fields: Record<string, string>) => action({ request: new Request('https://dxxxx.cloudfront.net/usage', { method: 'POST', body: formOf(fields) }), context: contexto(), params: {} } as never);
    await post({ email: 'luis@auteco.com', page: '2' });
    expect(listCreditLog).toHaveBeenLastCalledWith('token', { ...NO_FILTERS, email: 'luis@auteco.com', page: 2 });
    listCreditLog.mockClear();
    const r = await post({ email: 'luis' });
    expect([Object.keys(r.errors), r.log]).toEqual([['email'], null]);
    expect(listCreditLog).not.toHaveBeenCalled();
  });

  test('⛔ la ruta pide «ver» en Consumo y aparece en el menú como «Consumo» (CA-32)', () => {
    const ruta = ROUTE_TABLE.find((r) => r.path === 'usage');
    expect([ruta?.access, ruta?.menu?.label]).toEqual([{ module: 'usage', level: 'view' }, 'Consumo']);
  });

  test('⛔ las páginas son botones del formulario, no enlaces: los filtros, con su correo, viajan en el cuerpo', () => {
    const html = render(createElement(Pager, { page: { page: 2, pages: 3, total: 120, perPage: 50 }, of: '120 movimientos', submitName: 'page' }));
    const botones = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(botones.some((b) => b.includes('type="submit"') && b.includes('name="page"') && b.includes('value="3"'))).toBe(true);
    expect(html).not.toContain('href=');
  });
});

describe('las filas', () => {
  const fila = (cambios: Partial<CreditLogRow>): CreditLogRow => ({
    id: 'res_1', kind: 'spend', date: '2026-11-12T10:00:00Z', company: { id: 'auteco-4d5e6f', name: 'Auteco' }, email: 'luis@auteco.com',
    module: 'contacts', concept: 'contactos.buscar', status: 'charged', reserved: 150, charged: 90, returned: 60, discarded: 0,
    detail: { cantidad: 50 }, result: { personas: 30 }, sources: [{ kind: 'month', month: '2026-11', credits: 150 }],
    credits: null, name: null, expiresAt: null, loadedBy: null, reason: null, ...cambios,
  });

  test('⛔ un gasto dice qué fue, cuánto obtuvo, su estado, lo reservado, lo cobrado y de dónde salió (CA-27)', () => {
    const html = render(createElement(CreditLogTable, { rows: [fila({})] }));
    for (const texto of ['Contactos · buscar', '30 personas', 'cobrado', '150', '90', 'bolsa de 2026-11 · 150', 'Auteco', 'luis@auteco.com']) {
      expect(html, texto).toContain(texto);
    }
  });

  test('una carga dice quién la hizo y por qué, y un vencimiento cuánto se perdió (CA-29)', () => {
    const html = render(createElement(CreditLogTable, { rows: [
      fila({ id: 'lot_1', kind: 'load', status: null, credits: 11000, name: 'Carga de ENSŌ', loadedBy: 'Camila', reason: 'Factura 1234', sources: [] }),
      fila({ id: 'lot_2:vencimiento', kind: 'expiry', status: null, credits: 500, name: 'Small', sources: [] }),
    ] }));
    for (const texto of ['Carga · Carga de ENSŌ', 'por Camila · Factura 1234', '11.000', 'Vencimiento · Small', '500 sin usar']) {
      expect(html, texto).toContain(texto);
    }
  });
});
