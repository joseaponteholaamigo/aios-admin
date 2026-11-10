// Los créditos de una persona en el panel (spec «Créditos por persona» de aios-tower, CA-21, CA-22,
// CA-23 y CB-11): el diálogo de «Créditos» de la lista de personas y sus dos pedidos por detrás.
//
// EL DEFECTO QUE PREVIENE. Que se carguen créditos a otra cuenta que la de la dirección; que un doble
// clic cargue dos veces (el formulario tiene que llevar su clave); que el correo viaje en la dirección;
// y que vea o cargue créditos quien no tiene el permiso.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { readCreditLoad } from '../app/modules/client-users/credit-load-form-data';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';

const loadCredits = vi.fn();
const getPersonCredits = vi.fn();
const getCompanyPeople = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ loadCredits }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ getPersonCredits, getCompanyPeople }) }));
const { action: loadAction } = await import('../app/modules/client-users/routes/person-credits-load');
const { action: balanceAction } = await import('../app/modules/client-users/routes/person-credits');
const { loader: peopleLoader } = await import('../app/modules/client-users/routes/company-people');
const { PeoplePanel } = await import('../app/modules/client-users/components/people-panel');
const { CreditsDialog } = await import('../app/modules/client-users/components/credits-dialog');

const COMPANY = 'auteco-4d5e6f';
const miembro = (permissions: TeamMember['permissions']): TeamMember => ({ actor: 'equipo:sub', email: null, name: null, isSuperadmin: false, status: 'active', permissions });

function contexto(member: TeamMember = miembro({ companies: 'edit', usage: 'view' })) {
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

const postTo = (handler: (args: never) => Promise<unknown>, ruta: string, fields: Record<string, string>) => handler({
  request: new Request(`https://dxxxx.cloudfront.net/client-users/${COMPANY}/${ruta}`, { method: 'POST', body: formOf(fields) }),
  context: contexto(), params: { companyId: COMPANY },
} as never);

const render = (element: ReturnType<typeof createElement>) => {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/client-users/${COMPANY}`] }));
};

const CARGA = { email: 'luis@auteco.com', credits: '11000', reason: 'Factura 1234', key: 'carga-0001-abcd' };

beforeEach(() => { loadCredits.mockReset(); getPersonCredits.mockReset(); getCompanyPeople.mockReset(); });

describe('el formulario de carga', () => {
  test('acepta un entero de 1 a 100.000 con motivo y clave; lo demás se rechaza junto a su campo (CB-11)', () => {
    expect(readCreditLoad(formOf({ ...CARGA, email: ' Luis@Auteco.com ', credits: ' 11000 ' }))).toEqual({
      load: { email: 'luis@auteco.com', credits: 11000, reason: 'Factura 1234', key: 'carga-0001-abcd' },
    });
    // «11.000» y «1.5» se rechazan: aceptarlos obligaría a adivinar si son once mil, once o quince.
    for (const credits of ['0', '100001', '1.5', '11.000', '11,000', 'mil', '']) {
      const r = readCreditLoad(formOf({ ...CARGA, credits }));
      expect('errors' in r && Object.keys(r.errors), credits).toEqual(['credits']);
    }
    const sinClave = readCreditLoad(formOf({ ...CARGA, key: '' }));
    expect('errors' in sinClave && Object.keys(sinClave.errors)).toEqual(['key']);
  });
});

describe('los pedidos del diálogo', () => {
  test('⛔ la carga va a la cuenta de la dirección, con la clave del formulario, y devuelve el lote (CA-21, CA-22)', async () => {
    loadCredits.mockResolvedValue({ kind: 'ok', value: { credits: 11000, expiresAt: '2026-12-12T14:00:00Z' } });
    const r = await postTo(loadAction, 'credits/load', CARGA);
    expect(loadCredits).toHaveBeenCalledWith('token', COMPANY, { email: 'luis@auteco.com', credits: 11000, reason: 'Factura 1234', key: 'carga-0001-abcd' });
    expect(r).toEqual({ ok: true, loaded: { credits: 11000, expiresAt: '2026-12-12T14:00:00Z' } });
  });

  test('una carga rechazada o inválida vuelve con el motivo, y la inválida no llama a la API', async () => {
    loadCredits.mockResolvedValue({ kind: 'rejected', rejection: { code: 'not-found' }, createdAccountId: null });
    expect(await postTo(loadAction, 'credits/load', CARGA)).toEqual({ ok: false, errors: {}, rejection: { code: 'not-found' } });
    loadCredits.mockReset();
    const mal = (await postTo(loadAction, 'credits/load', { ...CARGA, credits: '0' })) as { ok: false; errors: Record<string, string> };
    expect(Object.keys(mal.errors)).toEqual(['credits']);
    expect(loadCredits).not.toHaveBeenCalled();
  });

  test('⛔ el saldo se pide con el correo del cuerpo, y un corte vuelve como motivo, no como página de error (CA-23)', async () => {
    getPersonCredits.mockResolvedValue({ kind: 'ok', value: { email: 'luis@auteco.com', access: 'with-plan', available: 1000, reserved: 0, month: { credits: 1000, balance: 1000, renewsAt: '2026-12-01T00:00:00Z' }, lots: [], movements: [] } });
    const r = (await postTo(balanceAction, 'credits', { email: ' Luis@Auteco.com ' })) as { ok: boolean; email: string };
    expect(getPersonCredits).toHaveBeenCalledWith('token', COMPANY, 'luis@auteco.com');
    expect([r.ok, r.email]).toEqual([true, 'luis@auteco.com']);
    getPersonCredits.mockResolvedValue({ kind: 'not-found' });
    expect(await postTo(balanceAction, 'credits', { email: 'nadie@auteco.com' })).toEqual({ email: 'nadie@auteco.com', ok: false, reason: 'not-found' });
  });

  test('⛔ ver el saldo pide «ver» en Consumo, y cargar pide «editar» en Empresas', () => {
    const acceso = (path: string) => ROUTE_TABLE.find((r) => r.path === path)?.access;
    expect(acceso('client-users/:companyId/credits')).toEqual({ module: 'usage', level: 'view' });
    expect(acceso('client-users/:companyId/credits/load')).toEqual({ module: 'companies', level: 'edit' });
  });
});

describe('lo que se ve', () => {
  test('⛔ el botón «Créditos» aparece solo con alguno de los dos permisos', async () => {
    getCompanyPeople.mockResolvedValue({ kind: 'ok', value: { company: { id: COMPANY, name: 'Auteco', kind: 'company' }, people: [], roles: [], log: [], revoked: [], domains: [], counts: {} } });
    const pedir = async (permissions: TeamMember['permissions']) => (await peopleLoader({ request: new Request(`https://dxxxx.cloudfront.net/client-users/${COMPANY}`), context: contexto(miembro(permissions)), params: { companyId: COMPANY } } as never)).credits;
    expect(await pedir({ usage: 'view' })).toEqual({ canSee: true, canLoad: false });
    expect(await pedir({ companies: 'edit' })).toEqual({ canSee: false, canLoad: true });
    expect(await pedir({ clientUsers: 'view' })).toEqual({ canSee: false, canLoad: false });

    const PERSONA = { email: 'luis@auteco.com', isAdmin: false, role: null, status: 'active', sees: { kind: 'all' }, counts: { skills: 0, agents: 0, chains: 0 }, invitedAt: null, acceptedAt: null };
    const panel = (credits: { canSee: boolean; canLoad: boolean }) => render(createElement(PeoplePanel, {
      people: [PERSONA] as never, roles: [], companyId: COMPANY, companyName: 'Auteco', personal: false, canAct: false, lastAttempt: null, credits,
    }));
    expect(panel({ canSee: false, canLoad: true })).toContain('>Créditos</button>');
    expect(panel({ canSee: false, canLoad: false })).not.toContain('Créditos');
  });

  test('⛔ el formulario de carga va por POST a la ruta de carga, con el correo y la clave en campos ocultos', () => {
    const html = render(createElement(CreditsDialog, { email: 'luis@auteco.com', companyId: COMPANY, canSee: false, canLoad: true, onClose: () => {} }));
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect([form.includes('method="post"'), form.includes(`action="/client-users/${COMPANY}/credits/load"`)]).toEqual([true, true]);
    expect(html).toContain('<input type="hidden" name="email" value="luis@auteco.com"/>');
    expect(html).toMatch(/<input type="hidden" name="key" value="carga-[0-9a-f-]{36}"\/>/);
    expect(html).not.toMatch(/action="[^"]*@/);
  });
});
