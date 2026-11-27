// La ficha de una cuenta, con lo que el equipo mira y hace antes de cambiar algo (spec «Editar cuentas y
// personas», fase 1: CA-1 a CA-6).
//
// EL DEFECTO QUE PREVIENE. Que quien no es superadministrador destrabe a la persona de una cuenta personal
// desde su ficha, o que la ficha le pida al backend el tope de la voz (le respondería 403 y la ficha se
// caería para todo el equipo menos uno); que un corte al leer ese tope tumbe la ficha entera; que el
// «Cambiar» de la voz abra la pantalla sin la cuenta; que la ficha calle el vencimiento, el cliente de
// Stripe o el antes y el después de un cambio; y que una cuenta personal ofrezca invitar a alguien más.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CompanyFile } from '../app/domain/companies';
import type { TeamMember } from '../app/domain/permissions';
import { voiceCapOf, type VoiceCaps } from '../app/domain/voice-cap';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { changeLines } from '../app/modules/companies/history-change';
import { prefilledAccount } from '../app/modules/voice/voice-form-data';
import { teamMember } from './helpers/fake-admin-api';

const personAction = vi.fn();
const read = { getCompany: vi.fn(), getCompanyHistory: vi.fn(), getVoiceCaps: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ personAction }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const companyRoute = await import('../app/modules/companies/routes/company');
const { default: CompanyPeople } = await import('../app/modules/client-users/routes/company-people');
const { CompanyHistoryCard } = await import('../app/modules/companies/components/company-history-card');
const { PendingDeletionsNotice } = await import('../app/modules/companies/components/pending-deletions-notice');
const { CapExceptionForm } = await import('../app/modules/voice/components/cap-exception-form');

const ID = 'maria-0000a1';
const jose = teamMember('jose', { isSuperadmin: true });
/** Todo lo de Empresas, Usuarios y Consumo, sin ser superadministradora. */
const ana = teamMember('ana', { permissions: { companies: 'edit', clientUsers: 'edit', usage: 'view' } });
const lector = teamMember('luis', { permissions: { companies: 'view' } });

const FILE: CompanyFile = {
  id: ID, name: 'Webinar C1', kind: 'personal', person: { email: 'maria@gmail.com', status: 'active', invitedAt: null, acceptedAt: null },
  origin: 'code', plan: 'custom', status: 'active', expiry: { expired: false, expiredBy: null, until: '2027-03-31' }, notice: 'vence el 31 mar',
  seats: { used: 1, cap: 1 }, admins: 1, paysWithStripe: true, stripeCanCharge: false, createdAt: '2026-10-28T15:00:00Z',
  effectivePlan: null, conditions: null, access: null, accessPending: 'falta publicar',
};
const CAPS: VoiceCaps = {
  general: { usd: 10, isDefault: true, changedBy: null, changedAt: null }, maxUsd: 20, onlySome: false,
  exceptions: [{ accountId: 'auteco-4d5e6f', accountName: 'Auteco', usd: 15, changedBy: null, changedAt: null }],
};

function contextOf(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

const openFile = (member: TeamMember) =>
  companyRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);

function postToFile(fields: Record<string, string>, member: TeamMember = jose) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return companyRoute.action({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`, { method: 'POST', body }), context: contextOf(member), params: { companyId: ID } } as never);
}

function render<P extends object>(Component: ComponentType<P>, props: P, at = `/companies/${ID}`) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

type FileData = Awaited<ReturnType<typeof openFile>>;
const renderFile = (loaderData: Partial<FileData>) => render(companyRoute.default as ComponentType<object>, {
  loaderData: { file: FILE, history: [], canSeePeople: true, canDelete: false, canChangePlan: false, planBlock: null, voiceCap: null, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false }, ...loaderData },
});

beforeEach(() => {
  personAction.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
  read.getCompany.mockResolvedValue({ kind: 'ok', value: FILE });
  read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
  read.getVoiceCaps.mockResolvedValue({ kind: 'ok', value: CAPS });
});

describe('CA-1 · la persona de una cuenta personal, desde su ficha', () => {
  test('⛔ destrabarla es solo del superadministrador; sus créditos, de quien tiene el permiso', async () => {
    const [deJose, deAna, deLector] = [await openFile(jose), await openFile(ana), await openFile(lector)];
    expect([deJose.personActions, deAna.personActions]).toEqual([['reset-mfa', 'delete-login'], []]);
    expect([deAna.credits, deLector.credits]).toEqual([{ canSee: true, canLoad: true }, { canSee: false, canLoad: false }]);
  });

  test('⛔ quien no es superadministrador recibe 403 al mandar una acción, y no se llama a la API', async () => {
    await expect(postToFile({ intent: 'reset-mfa', email: 'maria@gmail.com' }, ana)).rejects.toMatchObject({ init: { status: 403 } });
    expect(personAction).not.toHaveBeenCalled();
  });

  test('⛔ la acción va a la cuenta de la dirección con el correo en el cuerpo, y vuelve a la ficha con el aviso sin el correo', async () => {
    personAction.mockResolvedValue({ kind: 'ok', value: { action: 'delete-login', appUnlinked: null, noticeEmail: 'sent' } });
    const r = (await postToFile({ intent: 'delete-login', email: 'maria@gmail.com' })) as Response;
    expect(personAction).toHaveBeenCalledWith('token', ID, { action: 'delete-login', email: 'maria@gmail.com' });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}?persona=login-borrado`);
  });

  // EL DEFECTO: la ficha solo ofrece destrabar. Si aceptara «borrar persona» mandado a mano, dejaría la cuenta sin nadie.
  test('una acción que la ficha no ofrece no llega a la API', async () => {
    expect(await postToFile({ intent: 'delete-person', email: 'maria@gmail.com' })).toMatchObject({ attempt: null, rejection: { code: 'invalid' } });
    expect(personAction).not.toHaveBeenCalled();
  });

  test('la tarjeta «Persona» muestra los botones que corresponden, con los nombres de «Usuarios de clientes»', () => {
    const conTodo = renderFile({ personActions: ['reset-mfa', 'delete-login'], credits: { canSee: true, canLoad: false } });
    for (const label of ['>Créditos</button>', '>Restablecer verificación en dos pasos</button>', '>Borrar login</button>']) expect(conTodo).toContain(label);
    const sinNada = renderFile({});
    expect(sinNada).not.toContain('Créditos');
    expect(sinNada).not.toContain('Borrar login');
  });
});

describe('CA-2 · el tope de la voz en la ficha', () => {
  test('⛔ la ficha pide el tope solo para el superadministrador: a nadie más le llega un 403', async () => {
    expect((await openFile(ana)).voiceCap).toBeNull();
    expect(read.getVoiceCaps).not.toHaveBeenCalled();
    expect((await openFile(jose)).voiceCap).toEqual({ ok: true, cap: { usd: 10, source: 'general' } });
  });

  test('⛔ un corte al leer el tope no tumba la ficha: dice que no se pudo', async () => {
    read.getVoiceCaps.mockRejectedValue(new (await import('../app/shared/api/admin-api.server')).AdminApiUnavailableError('no responde'));
    expect((await openFile(jose)).voiceCap).toEqual({ ok: false });
  });

  test('rige la excepción de la cuenta si la tiene; si no, el general', () => {
    expect(voiceCapOf(CAPS, 'auteco-4d5e6f')).toEqual({ usd: 15, source: 'exception' });
    expect(voiceCapOf(CAPS, ID)).toEqual({ usd: 10, source: 'general' });
  });

  test('⛔ la línea dice cuál rige y su «Cambiar» abre «Voz» con la cuenta puesta', () => {
    const html = renderFile({ voiceCap: { ok: true, cap: { usd: 15, source: 'exception' } } });
    expect(html).toContain('US$15 por persona al mes · su excepción');
    expect(html).toContain(`href="/voice?account=${ID}"`);
    expect(renderFile({ voiceCap: null })).not.toContain('Tope de la voz');
  });

  test('⛔ la pantalla de la voz deja la cuenta de la dirección en el formulario de la excepción, y solo si es un id', () => {
    expect(prefilledAccount(new URLSearchParams({ account: ID }))).toBe(ID);
    expect(prefilledAccount(new URLSearchParams({ account: 'maria@gmail.com' }))).toBeNull();
    const html = render(CapExceptionForm, { maxUsd: 20, attempt: null, prefilledAccountId: ID }, '/voice');
    expect(html).toMatch(new RegExp(`<input[^>]*id="exception-account"[^>]*value="${ID}"`));
  });
});

describe('CA-3 a CA-5 · lo que la ficha ya podía mostrar', () => {
  test('⛔ la tarjeta «Cuenta» dice cuándo se creó, de dónde salió, cuándo vence con su aviso y si tiene cliente de Stripe', () => {
    const html = renderFile({});
    for (const fact of ['<dt>Creada</dt><dd>28 oct 2026</dd>', '<dt>Origen</dt><dd>Código</dd>', '<dt>Cliente de Stripe</dt><dd>Sí</dd>']) expect(html).toContain(fact);
    expect(html).toMatch(/<dt>Vence<\/dt><dd>31 mar 2027 <span class="badge warn">vence el 31 mar<\/span><\/dd>/);
    // Una cuenta personal tiene una sola persona: contar admins la haría parecer una empresa.
    expect(html).not.toContain('<dt>Admins</dt>');
    const empresa = renderFile({ file: { ...FILE, kind: 'company', name: 'Auteco', person: null, origin: null, admins: 2 } });
    expect(empresa).toContain('<dt>Admins</dt><dd>2</dd>');
    expect(empresa).not.toContain('<dt>Origen</dt>');
  });

  test('⛔ un evento de la historia con antes y después muestra los dos, campo por campo', () => {
    expect(changeLines({ asientos: 5, equipo: true }, { asientos: 8, equipo: true })).toEqual(['asientos: 5 → 8']);
    expect(changeLines(null, { topeUsd: 15 })).toEqual(['topeUsd: — → 15']);
    expect(changeLines({ estado: 'activo' }, null)).toEqual(['estado: activo → —']);
    expect(changeLines('free', 'personalizado')).toEqual(['free → personalizado']);
    expect(changeLines(null, null)).toEqual([]);
    const html = render(CompanyHistoryCard, { history: [{ source: 'audit', at: '2026-11-20T15:00:00Z', actor: 'equipo:sub-jose', what: 'voz.tope-de-la-cuenta', kind: null, reason: 'contrato', channel: null, detail: null, before: { topeUsd: null }, after: { topeUsd: 15 } }] });
    expect(html).toContain('topeUsd: — → 15');
  });

  test('⛔ el aviso de borrados a medias dice quién pidió cada uno', () => {
    const html = render(PendingDeletionsNotice, { pending: [{ id: 'acme-1a2b3c', startedAt: '2026-11-20T15:00:00Z', requestedBy: 'equipo:sub-jose' }, { id: 'otra-000001', startedAt: null, requestedBy: null }] }, '/companies');
    expect(html).toContain('lo pidió <span class="mono">equipo:sub-jose</span>');
    expect(html).toContain('sin dato de quién lo pidió');
  });
});

describe('CA-6 · invitar en una cuenta personal', () => {
  const peoplePage = (kind: 'company' | 'personal') => render(CompanyPeople as ComponentType<object>, {
    loaderData: {
      people: { company: { id: ID, name: 'Webinar C1', kind }, people: [], roles: [], revoked: [], log: [], domains: [], counts: { skills: 0, agents: 0, chains: 0 } },
      canSeeCompany: true, canInvite: true, actor: { superadmin: false, editUsers: true }, credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false },
    },
  }, `/client-users/${ID}`);

  test('⛔ una cuenta personal no ofrece «Invitar persona», aunque quien mira pueda invitar', () => {
    expect(peoplePage('personal')).not.toContain('Invitar persona');
    expect(peoplePage('company')).toContain('Invitar persona');
  });
});
