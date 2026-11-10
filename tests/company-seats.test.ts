// Cambiar los asientos de una empresa (spec «Créditos por persona» de aios-tower, CA-19, CA-20, CB-9
// y CB-10).
//
// EL DEFECTO QUE PREVIENE. Que el cambio vaya a otra empresa que la de la dirección; que se ofrezca
// cambiar los asientos de una cuenta personal o sin permiso; y que un rechazo pierda lo escrito.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { readSeatsChange } from '../app/modules/companies/seats-form-data';
import { seatsChangedNotice, seatsChangedNoticeParams, seatsEditable } from '../app/modules/companies/company-labels';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';

const changeSeats = vi.fn();
const getCompany = vi.fn();
const getCompanyHistory = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeSeats }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ getCompany, getCompanyHistory }) }));
const { action } = await import('../app/modules/companies/routes/company-seats');
const { loader: companyLoader } = await import('../app/modules/companies/routes/company');

const COMPANY = 'auteco-4d5e6f';
const editor: TeamMember = { actor: 'equipo:sub', email: null, name: null, isSuperadmin: false, status: 'active', permissions: { companies: 'edit' } };
const lector: TeamMember = { ...editor, permissions: { companies: 'view' } };

function contexto(member: TeamMember) {
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

const post = (fields: Record<string, string>) => action({
  request: new Request(`https://dxxxx.cloudfront.net/companies/${COMPANY}/seats`, { method: 'POST', body: formOf(fields) }),
  context: contexto(editor), params: { companyId: COMPANY },
} as never);

beforeEach(() => { changeSeats.mockReset(); getCompany.mockReset(); getCompanyHistory.mockReset(); });

describe('el formulario', () => {
  test('acepta un entero de 1 a 1.000 con motivo, y rechaza lo demás junto a su campo', () => {
    expect(readSeatsChange(formOf({ seats: ' 8 ', reason: ' amplió el contrato ' }))).toEqual({ change: { seats: 8, reason: 'amplió el contrato' } });
    for (const seats of ['0', '1001', '1.5', 'ocho', '']) {
      const r = readSeatsChange(formOf({ seats, reason: 'x' }));
      expect('errors' in r && Object.keys(r.errors), seats).toEqual(['seats']);
    }
    const sinMotivo = readSeatsChange(formOf({ seats: '8', reason: '  ' }));
    expect('errors' in sinMotivo && Object.keys(sinMotivo.errors)).toEqual(['reason']);
  });
});

describe('la acción', () => {
  test('⛔ cambia los asientos de la empresa de la dirección y vuelve a su ficha con el antes y el después (CA-19)', async () => {
    changeSeats.mockResolvedValue({ kind: 'ok', value: { before: 5, after: 8 } });
    const r = (await post({ seats: '8', reason: 'contrato' })) as Response;
    expect(changeSeats).toHaveBeenCalledWith('token', COMPANY, { seats: 8, reason: 'contrato' });
    expect(r.headers.get('Location')).toBe(`/companies/${COMPANY}?aviso=asientos&antes=5&despues=8`);
    expect(seatsChangedNotice(new URLSearchParams('aviso=asientos&antes=5&despues=8'))).toBe('Asientos cambiados de 5 a 8.');
  });

  test('⛔ bajar por debajo de los usados vuelve al formulario con lo escrito y el rechazo (CB-9)', async () => {
    changeSeats.mockResolvedValue({ kind: 'rejected', rejection: { code: 'seats-in-use', used: 5 }, createdAccountId: null });
    const r = (await post({ seats: '3', reason: 'baja' })) as { values: Record<string, string>; rejection: unknown };
    expect([r.values.seats, r.rejection]).toEqual(['3', { code: 'seats-in-use', used: 5 }]);
  });

  test('un formulario inválido no llama a la API', async () => {
    const r = (await post({ seats: '0', reason: '' })) as { errors: Record<string, string> };
    expect(Object.keys(r.errors).sort()).toEqual(['reason', 'seats']);
    expect(changeSeats).not.toHaveBeenCalled();
  });
});

describe('quién lo ve', () => {
  test('⛔ solo una empresa Personalizado se edita: ni una cuenta personal ni un plan de Stripe (CB-10)', () => {
    expect(seatsEditable({ kind: 'company', plan: 'custom' })).toBe(true);
    expect(seatsEditable({ kind: 'personal', plan: 'custom' })).toBe(false);
    expect(seatsEditable({ kind: 'company', plan: 'team' })).toBe(false);
  });

  test('⛔ la ficha ofrece «Cambiar asientos» solo con «editar» en Empresas, y la ruta lo exige (CA-20)', async () => {
    getCompany.mockResolvedValue({ kind: 'ok', value: { id: COMPANY, name: 'Auteco', kind: 'company', plan: 'custom', seats: { used: 3, cap: 5 }, conditions: { seats: 5 } } });
    getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
    const pedir = (member: TeamMember) => companyLoader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${COMPANY}`), context: contexto(member), params: { companyId: COMPANY } } as never);
    expect([(await pedir(editor)).canEditSeats, (await pedir(lector)).canEditSeats]).toEqual([true, false]);
    expect(ROUTE_TABLE.find((r) => r.path === 'companies/:companyId/seats')?.access).toEqual({ module: 'companies', level: 'edit' });
  });

  test('el aviso de la ficha no inventa un cambio que no hubo', () => {
    expect(seatsChangedNotice(new URLSearchParams(seatsChangedNoticeParams({ before: 5, after: 5 })))).toBe('La empresa ya tenía 5 asientos: no cambió nada.');
    expect(seatsChangedNotice(new URLSearchParams('aviso=creada'))).toBeNull();
  });
});
