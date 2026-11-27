// «Cambiar plan» desde la ficha de una cuenta (spec «Editar cuentas y personas», CA-27 a CA-30).
//
// EL DEFECTO QUE PREVIENE. Que se ofrezca cambiar el plan de una cuenta cuya suscripción de Stripe sigue
// cobrando (su próximo evento pisaría el cambio) o de una revocada; que el formulario abra con otras
// condiciones que las de hoy y, al guardar sin tocar nada, le cambie la cuenta a alguien; que una cuenta
// personal termine con asientos o equipo; que «Guardar» guarde algo distinto de lo que se vio; que no se
// pueda quitar un cupo; que un rechazo se pierda o deje la pantalla sin botón; y que el aviso de la ficha
// muestre un texto que vino en la dirección.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PRO_CONDITIONS } from '../app/domain/account-creation';
import type { CompanyFile } from '../app/domain/companies';
import type { TeamMember } from '../app/domain/permissions';
import { lockedToCustom, planChangeBlock, type PlanChangeResult } from '../app/domain/plan-change';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';
import { currentConditions, currentPlanChoice, planChangeFingerprint, readPlanChange } from '../app/modules/companies/plan-change-form-data';
import { planSavedNotice, planSavedNoticeParams } from '../app/modules/companies/plan-change-labels';
import { teamMember } from './helpers/fake-admin-api';

const changePlan = vi.fn();
const read = { getCompany: vi.fn(), getCompanyHistory: vi.fn(), getVoiceCaps: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changePlan }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const planRoute = await import('../app/modules/companies/routes/company-plan');
const companyRoute = await import('../app/modules/companies/routes/company');
const { PlanChangeForm } = await import('../app/modules/companies/components/plan-change-form');

const ID = 'auteco-4d5e6f';
const editora = teamMember('ana', { permissions: { companies: 'edit' } });
const lectora = teamMember('luz', { permissions: { companies: 'view' } });

const FILE: CompanyFile = {
  id: ID, name: 'Auteco', kind: 'company', person: null, origin: null, plan: 'custom', status: 'active',
  expiry: { expired: false, expiredBy: null, until: '2027-03-31' }, notice: null, seats: { used: 3, cap: 5 }, admins: 1,
  paysWithStripe: false, stripeCanCharge: false, createdAt: '2026-10-01T00:00:00Z', effectivePlan: null,
  conditions: { seats: 5, content: null, team: true, scheduling: false, until: '2027-03-31', quotas: { radar: 3 } },
  access: { base: 'free', rules: [], counts: { skills: 0, agents: 0, chains: 0 } }, accessPending: null,
};
const PERSONAL: CompanyFile = {
  ...FILE, id: 'maria-0000a1', name: 'Webinar C1', kind: 'personal', person: { email: 'maria@gmail.com', status: 'active', invitedAt: null, acceptedAt: null },
  seats: { used: 1, cap: 1 }, conditions: { seats: 1, content: null, team: false, scheduling: true, until: null, quotas: {} },
  access: { base: 'everything', rules: [], counts: { skills: 0, agents: 0, chains: 0 } },
};

const PREVIEW: PlanChangeResult = {
  previewOnly: true, changed: true,
  before: { plan: 'custom', content: 'free', conditions: { seats: 5, content: null, team: true, scheduling: false, until: '2027-03-31', quotas: { radar: 3 } } },
  after: { plan: 'free', content: null, conditions: null },
  notices: ['en Free entra una sola persona: las otras 2 quedan en pausa'], toConfirm: ['loses-conditions', 'pauses-people'], pausedPeople: 2,
};

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function contextOf(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

const post = (fields: Record<string, string>) => planRoute.action({
  request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}/plan`, { method: 'POST', body: formOf(fields) }),
  context: contextOf(editora), params: { companyId: ID },
} as never);

function render<P extends object>(Component: ComponentType<P>, props: P) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/companies/${ID}/plan`] }));
}

type FormProps = Parameters<typeof PlanChangeForm>[0];
const renderForm = (props: Partial<FormProps> = {}) => render(PlanChangeForm, {
  company: { id: ID, kind: 'company' }, current: { choice: currentPlanChoice(FILE), conditions: currentConditions(FILE) },
  lockedToCustom: false, seatsUsed: 3, values: null, errors: {}, rejection: null, latest: null, ...props,
});

/** Lo que manda el formulario de una empresa que pasa a Free. */
const A_FREE = { kind: 'company', plan: 'free', reason: 'terminó el contrato' };

beforeEach(() => {
  changePlan.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
  read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
});

describe('CA-27 · quién ve «Cambiar plan» y cuándo se puede', () => {
  test('⛔ una suscripción que cobra o una cuenta revocada lo frenan; un Personalizado que cobra cambia sus condiciones', () => {
    expect(planChangeBlock({ status: 'active', plan: 'pro', stripeCanCharge: true })).toBe('charging');
    expect(planChangeBlock({ status: 'revoked', plan: 'custom', stripeCanCharge: false })).toBe('revoked');
    expect(planChangeBlock({ status: 'active', plan: 'custom', stripeCanCharge: true })).toBeNull();
    expect(lockedToCustom({ status: 'active', plan: 'custom', stripeCanCharge: true })).toBe(true);
  });

  test('⛔ la ficha lo ofrece con «editar» en Empresas, y la ruta lo exige', async () => {
    read.getCompany.mockResolvedValue({ kind: 'ok', value: FILE });
    const abrir = (member: TeamMember) => companyRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);
    expect([(await abrir(editora)).canChangePlan, (await abrir(lectora)).canChangePlan]).toEqual([true, false]);
    expect(ROUTE_TABLE.find((r) => r.path === 'companies/:companyId/plan')?.access).toEqual({ module: 'companies', level: 'edit' });
    expect(ROUTE_TABLE.some((r) => r.path.endsWith('/seats'))).toBe(false);
  });

  test('⛔ desactivado, dice por qué a la vista; activo, lleva a la pantalla del plan', () => {
    const ficha = (file: CompanyFile) => render(companyRoute.default as ComponentType<object>, {
      loaderData: { file, history: [], canSeePeople: false, canDelete: false, canChangePlan: true, planBlock: planChangeBlock(file), voiceCap: null, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false } },
    });
    const cobrando = ficha({ ...FILE, plan: 'team', stripeCanCharge: true });
    expect(cobrando).toMatch(/<button type="button" class="btn" disabled="" aria-describedby="plan-block-reason">Cambiar plan<\/button>/);
    expect(cobrando).toContain('primero hay que cancelarla en Stripe');
    expect(ficha(FILE)).toContain(`href="/companies/${ID}/plan"`);
    expect(ficha(FILE)).not.toContain('Cambiar asientos');
  });
});

describe('CA-28 · con qué abre el formulario', () => {
  test('⛔ con las condiciones de hoy: el contenido de su acceso, sus asientos, su fecha de fin y sus cupos', () => {
    expect(currentPlanChoice(FILE)).toBe('custom');
    expect(currentConditions(FILE)).toEqual({ content: 'free', seats: 5, team: true, schedules: false, endsOn: '2027-03-31', quotas: { radar: 3 } });
  });

  test('una cuenta personal con las condiciones de Pro abre en «Pro»; un plan comprado en la web, sin plan elegido', () => {
    expect(currentPlanChoice(PERSONAL)).toBe('pro');
    expect(currentPlanChoice({ ...FILE, plan: 'team', conditions: null })).toBeNull();
    expect(currentPlanChoice({ ...FILE, plan: 'free', conditions: null })).toBe('free');
  });

  test('⛔ los cupos de hoy vienen escritos, para que guardar sin tocarlos no los borre', () => {
    expect(renderForm()).toMatch(/<input id="quota-radar"[^>]*value="3"/);
  });

  test('⛔ una empresa elige Free o Personalizado; una cuenta personal, además Pro, y sin asientos ni equipo', () => {
    const opciones = (html: string) => [...(html.match(/<select id="plan"[\s\S]*?<\/select>/)?.[0] ?? '').matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    expect(opciones(renderForm())).toEqual(['free', 'custom']);
    const personal = renderForm({ company: { id: PERSONAL.id, kind: 'personal' }, current: { choice: 'custom', conditions: currentConditions(PERSONAL) } });
    expect(opciones(personal)).toEqual(['free', 'pro', 'custom']);
    expect(personal).not.toContain('id="seats"');
    expect(personal).not.toContain('name="team"');
  });

  test('un Personalizado que cobra por Stripe no puede elegir Free', () => {
    expect(renderForm({ lockedToCustom: true })).toMatch(/<option value="free" disabled="">Free<\/option>/);
  });
});

describe('CA-28 · lo que manda el formulario', () => {
  test('⛔ en una cuenta personal, Pro son las condiciones fijas con su fecha, y Personalizado queda con un asiento y sin equipo', () => {
    expect(readPlanChange(formOf({ kind: 'personal', plan: 'pro', proEndsOn: '2027-01-31', content: 'none', reason: '' })))
      .toEqual({ change: { target: { plan: 'custom', conditions: { ...PRO_CONDITIONS, quotas: {}, endsOn: '2027-01-31' } }, reason: '' } });
    const personalizado = readPlanChange(formOf({ kind: 'personal', plan: 'custom', content: 'all', seats: '9', team: 'on', endsOn: '', reason: '' }));
    expect(personalizado).toMatchObject({ change: { target: { conditions: { seats: 1, team: false } } } });
  });

  test('Pro en una empresa se rechaza junto al plan, sin llamar a la API', async () => {
    const r = (await post({ kind: 'company', plan: 'pro', reason: '' })) as { errors: Record<string, string> };
    expect(Object.keys(r.errors)).toEqual(['plan']);
    expect(changePlan).not.toHaveBeenCalled();
  });

  test('⛔ el pedido va por PATCH en los nombres del backend: ver lleva `soloVer`, guardar lleva `confirmo`, y los cupos viajan aunque estén vacíos', async () => {
    const seen: { url: string; method: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
      return Response.json({ soloVer: true, cambio: true, antes: { plan: 'free' }, despues: { plan: 'personalizado', contenido: 'todo', condiciones: { asientos: 2 } }, avisos: [], confirmar: ['vacio'], personasEnPausa: 0 });
    }) as unknown as typeof fetch;
    const api = createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} });
    const conditions = { content: 'all' as const, seats: 2, team: true, schedules: true, endsOn: null, quotas: {} };
    const r = await api.changePlan('t', ID, { target: { plan: 'custom', conditions }, reason: '', previewOnly: true });
    await api.changePlan('t', ID, { target: { plan: 'free' }, reason: 'terminó', previewOnly: false });
    expect(seen).toEqual([
      { url: `https://api.example/v1/admin/clientes/${ID}/condiciones`, method: 'PATCH', body: { plan: 'personalizado', condiciones: { contenido: 'todo', asientos: 2, equipo: true, horarios: true, hasta: null, cupos: {} }, soloVer: true } },
      { url: `https://api.example/v1/admin/clientes/${ID}/condiciones`, method: 'PATCH', body: { plan: 'free', motivo: 'terminó', confirmo: true } },
    ]);
    expect(r.kind === 'ok' && [r.value.before.plan, r.value.after.plan, r.value.after.content, r.value.after.conditions?.seats, r.value.toConfirm]).toEqual(['free', 'custom', 'everything', 2, ['empty']]);
  });
});

describe('CA-28 · los dos pasos', () => {
  test('⛔ «Ver el cambio» pide la vista previa y vuelve con ella, sin guardar', async () => {
    changePlan.mockResolvedValue({ kind: 'ok', value: PREVIEW });
    const r = (await post({ ...A_FREE, intent: 'preview' })) as { shown: { previewed: string; stale: boolean } };
    expect(changePlan).toHaveBeenCalledWith('token', ID, { target: { plan: 'free' }, reason: 'terminó el contrato', previewOnly: true });
    expect(r.shown).toMatchObject({ previewed: planChangeFingerprint({ target: { plan: 'free' }, reason: 'terminó el contrato' }), stale: false });
  });

  test('⛔ «Guardar» manda el mismo pedido con la confirmación y vuelve a la ficha con el aviso', async () => {
    changePlan.mockResolvedValue({ kind: 'ok', value: { ...PREVIEW, previewOnly: false } });
    const previewed = planChangeFingerprint({ target: { plan: 'free' }, reason: 'terminó el contrato' });
    const r = (await post({ ...A_FREE, intent: 'save', previewed })) as Response;
    expect(changePlan).toHaveBeenCalledWith('token', ID, { target: { plan: 'free' }, reason: 'terminó el contrato', previewOnly: false });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}?aviso=plan&antes=custom&despues=free`);
  });

  test('⛔ si lo escrito cambió después de verlo, «Guardar» no guarda: muestra la vista previa nueva', async () => {
    changePlan.mockResolvedValue({ kind: 'ok', value: PREVIEW });
    const viejo = planChangeFingerprint({ target: { plan: 'free' }, reason: 'otro motivo' });
    const r = (await post({ ...A_FREE, intent: 'save', previewed: viejo })) as { shown: { stale: boolean } };
    expect(changePlan).toHaveBeenCalledWith('token', ID, expect.objectContaining({ previewOnly: true }));
    expect(r.shown.stale).toBe(true);
  });

  test('⛔ un rechazo vuelve al formulario con lo escrito y el motivo traducido (CA-29)', async () => {
    changePlan.mockResolvedValue({ kind: 'rejected', rejection: { code: 'seats-in-use', used: 5 }, createdAccountId: null });
    const r = (await post({ kind: 'company', plan: 'custom', content: 'all', seats: '3', endsOn: '', reason: '', intent: 'preview' })) as { values: Record<string, string>; rejection: unknown };
    expect([r.values.seats, r.rejection]).toEqual(['3', { code: 'seats-in-use', used: 5 }]);
  });

  test('sin vista previa solo está «Ver el cambio»; con una, «Guardar» la confirma, con lo que se pierde a la vista (CA-30)', () => {
    // El botón entero, por su valor: React ordena los atributos a su modo.
    const button = (html: string, value: string) => html.match(new RegExp(`<button[^>]*value="${value}"[^>]*>[^<]*</button>`))?.[0] ?? '';
    const sinVer = renderForm();
    expect(button(sinVer, 'preview')).toMatch(/class="btn primary submit-button".*>Ver el cambio</);
    expect(button(sinVer, 'save')).toBe('');
    const conVista = renderForm({ latest: { preview: PREVIEW, previewed: 'huella', stale: false } });
    expect(button(conVista, 'save')).toMatch(/class="btn primary submit-button".*>Confirmar y guardar</);
    expect(conVista).toContain('<input type="hidden" name="previewed" value="huella"/>');
    expect(conVista).toContain('Pierde las condiciones del Personalizado');
    expect(conVista).toContain('otras 2 quedan en pausa');
    expect(conVista).toMatch(/<tr class="plan-change-preview__changed"><td class="small">Plan<\/td><td class="small">Personalizado<\/td><td class="small">Free<\/td><\/tr>/);
  });

  test('una vista previa sin cambios lo dice y no ofrece guardar', () => {
    const html = renderForm({ latest: { preview: { ...PREVIEW, changed: false, toConfirm: [] }, previewed: 'huella', stale: false } });
    expect(html).toContain('no hay nada que guardar');
    expect(html).not.toContain('value="save"');
  });
});

describe('el aviso en la ficha', () => {
  test('dice qué cambió, o que no cambió nada', () => {
    const aviso = (r: Pick<PlanChangeResult, 'changed' | 'before' | 'after'>) => planSavedNotice(planSavedNoticeParams(r));
    expect(aviso(PREVIEW)).toMatch(/^Plan cambiado de Personalizado a Free\./);
    expect(aviso({ changed: true, before: PREVIEW.before, after: PREVIEW.before })).toMatch(/^Se guardaron las condiciones del Personalizado\./);
    expect(aviso({ changed: false, before: PREVIEW.before, after: PREVIEW.before })).toBe('Lo pedido ya era lo que tenía: no cambió nada.');
  });

  test('⛔ un plan que el panel no conoce, puesto a mano en la dirección, no se muestra', () => {
    expect(planSavedNotice(new URLSearchParams({ aviso: 'plan', antes: 'free', despues: 'Llama al 555' }))).toBeNull();
  });
});

describe('una cuenta que no cambia de plan', () => {
  test('⛔ la pantalla dice por qué y no muestra el formulario', () => {
    const html = render(planRoute.default as ComponentType<object>, {
      loaderData: { company: { id: ID, title: 'Auteco', kind: 'company' }, current: { choice: null, conditions: currentConditions(FILE) }, block: 'revoked', lockedToCustom: false, seatsUsed: 3 },
    });
    expect(html).toContain('La cuenta está revocada');
    expect(html).not.toContain('Ver el cambio');
  });
});
