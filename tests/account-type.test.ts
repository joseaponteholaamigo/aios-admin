// Pasar una empresa a cuenta personal, y al revés, desde su ficha (spec «Pasar una empresa a cuenta personal, y al
// revés», CA-11 a CA-15).
//
// EL DEFECTO QUE PREVIENE. Que alguien que no es superadministrador vea o mande el cambio —cambia lo que la persona
// puede comprar en ENSŌ y si un «mover» puede borrar la cuenta—; que el panel le mande al backend sus nombres en
// inglés, o que la vista previa no lleve `soloVer` y cambie el tipo con solo abrir el diálogo; que un tipo que el panel
// no conoce se muestre como el otro; que el diálogo no diga qué cambia (la pestaña, los créditos, que un mover borraría
// la cuenta) o a quién; que una negativa de la vista previa se pierda o deje ofrecer «Guardar»; que el aviso de la
// ficha repita un texto que vino en la dirección; y que la historia calle el cambio de tipo.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { accountStatusOffer } from '../app/domain/account-status';
import { accountTypeTarget, type AccountTypeResult } from '../app/domain/account-type';
import type { WriteRejection } from '../app/domain/account-creation';
import type { CompanyFile } from '../app/domain/companies';
import type { TeamMember } from '../app/domain/permissions';
import { planChangeBlock } from '../app/domain/plan-change';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { rejectionMessage } from '../app/shared/labels/write-rejection-labels';
import { accessFor, allows } from '../app/shared/routing/route-access';
import { isTypePreview, readTypeChange, saveOfferOf, type TypeAnswer } from '../app/modules/companies/account-type-form-data';
import { typeChangedNotice, typeChangedNoticeParams, typeRejectionMessage } from '../app/modules/companies/account-type-labels';
import { teamMember } from './helpers/fake-admin-api';

const changeAccountType = vi.fn();
const read = { getCompany: vi.fn(), getCompanyHistory: vi.fn(), getVoiceCaps: vi.fn(), getCompanyHouse: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeAccountType }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const typeRoute = await import('../app/modules/companies/routes/company-type');
const companyRoute = await import('../app/modules/companies/routes/company');
const { AccountTypePreview } = await import('../app/modules/companies/components/account-type-preview');
const { AccountTypeDialog } = await import('../app/modules/companies/components/account-type-dialog');
const { CompanyHistoryCard } = await import('../app/modules/companies/components/company-history-card');

const ID = 'acme-1a2b3c';
const jose = teamMember('jose', { isSuperadmin: true });
/** Todo lo de Empresas y Usuarios, sin ser superadministradora. */
const ana = teamMember('ana', { permissions: { companies: 'edit', clientUsers: 'edit' } });

const COMPANY: CompanyFile = {
  id: ID, name: 'Acme', kind: 'company', person: null, origin: null, plan: 'pro', status: 'active',
  expiry: { expired: false, expiredBy: null, until: null }, notice: null, seats: { used: 1, cap: 1 }, admins: 1,
  paysWithStripe: false, stripeCanCharge: false, createdAt: '2026-10-01T00:00:00Z', effectivePlan: null,
  conditions: null, access: null, accessPending: null,
};
const PERSONAL: CompanyFile = {
  ...COMPANY, kind: 'personal', origin: 'signup', person: { email: 'ana@acme.com', status: 'active', invitedAt: null, acceptedAt: null },
};

/** La respuesta 200 del contrato: la vista previa de pasar una empresa de una persona a cuenta personal. */
const TO_PERSONAL_BODY = { tenantId: ID, soloVer: true, cambio: true, tipo: { antes: 'empresa', despues: 'personal' }, persona: 'ana@acme.com' };
const TO_PERSONAL: AccountTypeResult = { previewOnly: true, changed: true, kind: { before: 'company', after: 'personal' }, person: 'ana@acme.com' };
const TO_COMPANY_SAVED: AccountTypeResult = { previewOnly: false, changed: true, kind: { before: 'personal', after: 'company' }, person: 'ana@acme.com' };

function contextOf(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const post = (fields: Record<string, string>) => typeRoute.action({
  request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}/type`, { method: 'POST', body: formOf(fields) }),
  context: contextOf(jose), params: { companyId: ID },
} as never);

const openFile = (member: TeamMember) =>
  companyRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);

function render<P extends object>(Component: ComponentType<P>, props: P, at = `/companies/${ID}`) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

/** La ficha como la ve el superadministrador (o quien sea, con `superadmin: false`). */
const renderFile = (file: CompanyFile, superadmin = true) => render(companyRoute.default as ComponentType<object>, {
  loaderData: {
    file, history: [], canSeePeople: false, canDelete: superadmin, canChangePlan: false, planBlock: planChangeBlock(file),
    statusAction: superadmin ? accountStatusOffer(file) : null, typeTarget: superadmin ? accountTypeTarget(file.kind) : null,
    voiceCap: null, house: null, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false },
  },
});

/** El botón con ese texto, entero, o `''`. */
const buttonWith = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>(?:<[^>]+>)*${label}</button>`))?.[0] ?? '';

function writeApiAnswering(respond: () => Response) {
  const seen: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
    return respond();
  }) as unknown as typeof fetch;
  return { api: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), seen };
}

const historyOf = async (body: unknown) => {
  const api = createAdminReadApi({ baseUrl: 'https://api.example', log: () => {}, fetchImpl: (async () => Response.json(body)) as unknown as typeof fetch });
  const r = await api.getCompanyHistory('t', ID);
  if (r.kind !== 'ok') throw new Error('la historia no se leyó');
  return r.value;
};

const rejected = (rejection: WriteRejection): TypeAnswer => ({ ok: false, rejection, errors: {} });

beforeEach(() => {
  changeAccountType.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
  read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
  read.getVoiceCaps.mockResolvedValue({ kind: 'ok', value: { general: { usd: 10 }, exceptions: [] } });
  read.getCompanyHouse.mockResolvedValue({ kind: 'ok', value: { pause: null, frozenLots: [] } });
});

describe('CA-11 · quién ve «Pasar a cuenta personal» y «Pasar a empresa», y en qué cuenta', () => {
  test('⛔ la ficha lo ofrece solo al superadministrador: «editar» en Empresas no alcanza', async () => {
    read.getCompany.mockResolvedValue({ kind: 'ok', value: COMPANY });
    expect([(await openFile(jose)).typeTarget, (await openFile(ana)).typeTarget]).toEqual(['personal', null]);
  });

  test('⛔ la ruta que cambia el tipo es solo del superadministrador', () => {
    const access = accessFor(new URL(`https://dxxxx.cloudfront.net/companies/${ID}/type`));
    expect(access).toBe('superadmin');
    expect([allows(ana, access!), allows(jose, access!)]).toEqual([false, true]);
  });

  test('⛔ una empresa ofrece «Pasar a cuenta personal»; una cuenta personal, «Pasar a empresa»', () => {
    const empresa = renderFile(COMPANY);
    expect(buttonWith(empresa, 'Pasar a cuenta personal')).not.toBe('');
    expect(empresa).not.toContain('Pasar a empresa');
    const personal = renderFile(PERSONAL);
    expect(buttonWith(personal, 'Pasar a empresa')).not.toBe('');
    expect(personal).not.toContain('Pasar a cuenta personal');
  });

  test('⛔ quien no es superadministrador no ve ninguno de los dos', () => {
    const html = renderFile(COMPANY, false);
    expect(html).not.toContain('Pasar a cuenta personal');
    expect(html).not.toContain('Pasar a empresa');
  });
});

describe('CA-12 y CA-13 · el pedido y su respuesta', () => {
  test('⛔ va por POST en los nombres del backend: la vista previa lleva `soloVer`; guardar, el motivo solo si se escribió', async () => {
    const { api, seen } = writeApiAnswering(() => Response.json(TO_PERSONAL_BODY));
    const r = await api.changeAccountType('t', ID, { kind: 'personal', reason: null, previewOnly: true });
    await api.changeAccountType('t', ID, { kind: 'company', reason: 'ahora son tres', previewOnly: false });
    await api.changeAccountType('t', ID, { kind: 'personal', reason: null, previewOnly: false });
    const url = `https://api.example/v1/admin/clientes/${ID}/tipo`;
    expect(seen).toEqual([
      { url, method: 'POST', body: { tipo: 'personal', soloVer: true } },
      { url, method: 'POST', body: { tipo: 'empresa', motivo: 'ahora son tres' } },
      { url, method: 'POST', body: { tipo: 'personal' } },
    ]);
    expect(r).toEqual({ kind: 'ok', value: TO_PERSONAL });
  });

  test('⛔ una respuesta con un tipo que el panel no conoce rompe el contrato: no se muestra como el otro', async () => {
    const { api } = writeApiAnswering(() => Response.json({ ...TO_PERSONAL_BODY, tipo: { antes: 'empresa', despues: 'equipo' } }));
    await expect(api.changeAccountType('t', ID, { kind: 'personal', reason: null, previewOnly: true })).rejects.toBeInstanceOf(ApiContractError);
  });

  test('⛔ cada rechazo del contrato vuelve como rechazo, con los nombres del panel', async () => {
    const casos: [number, object, WriteRejection][] = [
      [404, { codigo: 'no-existe' }, { code: 'not-found' }],
      [422, { codigo: 'invalido', error: 'el tipo es empresa o personal' }, { code: 'invalid', message: 'el tipo es empresa o personal', field: null }],
      [409, { codigo: 'plan-de-equipo' }, { code: 'team-plan' }],
      [409, { codigo: 'varias-personas' }, { code: 'several-people' }],
      [409, { codigo: 'moviendo' }, { code: 'moving' }],
      [409, { codigo: 'conflicto' }, { code: 'conflict' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { api } = writeApiAnswering(() => Response.json(body, { status }));
      expect(await api.changeAccountType('t', ID, { kind: 'personal', reason: null, previewOnly: true })).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });
});

describe('CA-12 a CA-14 · la ruta del diálogo', () => {
  test('⛔ la vista previa llega a la API sin motivo, y vuelve al diálogo sin escribir', async () => {
    changeAccountType.mockResolvedValue({ kind: 'ok', value: TO_PERSONAL });
    expect(await post({ kind: 'personal', intent: 'preview', reason: 'no viaja' })).toEqual({ ok: true, preview: TO_PERSONAL });
    expect(changeAccountType).toHaveBeenCalledWith('token', ID, { kind: 'personal', reason: null, previewOnly: true });
  });

  test('⛔ el motivo es opcional: guardar sin él llega a la API sin motivo', async () => {
    changeAccountType.mockResolvedValue({ kind: 'ok', value: TO_COMPANY_SAVED });
    await post({ kind: 'company', intent: 'save', reason: '   ' });
    expect(changeAccountType).toHaveBeenCalledWith('token', ID, { kind: 'company', reason: null, previewOnly: false });
  });

  test('⛔ guardar manda el motivo y vuelve a la ficha con el aviso', async () => {
    changeAccountType.mockResolvedValue({ kind: 'ok', value: TO_COMPANY_SAVED });
    const r = (await post({ kind: 'company', intent: 'save', reason: ' ahora son tres ' })) as Response;
    expect(changeAccountType).toHaveBeenCalledWith('token', ID, { kind: 'company', reason: 'ahora son tres', previewOnly: false });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}?aviso=a-empresa`);
  });

  test('⛔ un motivo de más de 500 caracteres se dice junto al campo y no llega a la API', async () => {
    expect(await post({ kind: 'personal', intent: 'save', reason: 'x'.repeat(501) })).toMatchObject({ errors: { reason: 'El motivo va hasta 500 caracteres.' } });
    expect(changeAccountType).not.toHaveBeenCalled();
  });

  test('⛔ un rechazo se queda en el diálogo con su porqué', async () => {
    changeAccountType.mockResolvedValue({ kind: 'rejected', rejection: { code: 'several-people' }, createdAccountId: null });
    expect(await post({ kind: 'personal', intent: 'save' })).toEqual({ ok: false, rejection: { code: 'several-people' }, errors: {} });
  });

  test('un pedido con un tipo o un paso que el panel no conoce no llega a la API', async () => {
    expect(await post({ kind: 'empresa', intent: 'save' })).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    expect(await post({ kind: 'personal', intent: 'otra' })).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    expect(changeAccountType).not.toHaveBeenCalled();
  });

  test('⛔ la vista previa no vuelve a pedir la ficha; guardar, sí', () => {
    const args = (fields: Record<string, string>) => ({ formData: formOf(fields), defaultShouldRevalidate: true }) as never;
    expect(isTypePreview(formOf({ kind: 'personal', intent: 'preview' }))).toBe(true);
    expect(companyRoute.shouldRevalidate(args({ kind: 'personal', intent: 'preview' }))).toBe(false);
    expect(companyRoute.shouldRevalidate(args({ kind: 'personal', intent: 'save' }))).toBe(true);
  });

  test('la vista previa no lleva el motivo aunque venga en el formulario', () => {
    expect(readTypeChange(formOf({ kind: 'company', intent: 'preview', reason: 'x' }))).toEqual({ change: { kind: 'company', reason: null, previewOnly: true } });
  });
});

describe('CA-12 y CA-13 · lo que dice el diálogo', () => {
  const preview = (props: Parameters<typeof AccountTypePreview>[0]) => render(AccountTypePreview, props);

  test('⛔ a cuenta personal dice la pestaña, los créditos y, en tono de aviso y con la persona, que un mover borraría la cuenta', () => {
    const html = preview({ target: 'personal', answer: { ok: true, preview: TO_PERSONAL }, introId: 'i' });
    for (const text of ['Pasa de la pestaña «Empresas» a «Cuentas personales».', 'puede comprar paquetes de créditos por Stripe', 'su correo espera 24 horas']) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/<li class="account-type-dialog__warn">Si ana@acme\.com pasa a otra empresa \(con «mover» desde el panel[^<]*esta cuenta se borra\.<\/li>/);
  });

  test('⛔ a empresa dice la pestaña y que los créditos ya no se compran por Stripe; sin persona, no inventa un correo', () => {
    const html = preview({ target: 'company', answer: { ok: true, preview: { ...TO_COMPANY_SAVED, previewOnly: true, person: null } }, introId: 'i' });
    expect(html).toContain('Pasa de la pestaña «Cuentas personales» a «Empresas».');
    expect(html).toContain('ya no compra paquetes de créditos por Stripe: los carga el superadministrador');
    expect(html).toContain('Si otra empresa invita a su persona, no puede');
    expect(html).not.toContain('account-type-dialog__warn');
  });

  test('si la cuenta ya era de ese tipo, dice que no hay nada que cambiar', () => {
    const html = preview({ target: 'personal', answer: { ok: true, preview: { ...TO_PERSONAL, changed: false } }, introId: 'i' });
    expect(html).toContain('La cuenta ya es cuenta personal: no hay nada que cambiar.');
    expect(html).not.toContain('Cuentas personales');
  });

  test('⛔ CA-13: la negativa por el plan dice qué hacer primero; la de varias personas y la del mover, por qué', () => {
    const html = (rejection: WriteRejection) => preview({ target: 'personal', answer: rejected(rejection), introId: 'i' });
    expect(html({ code: 'team-plan' })).toContain('Primero cámbiale el plan a uno de una persona con «Cambiar plan»');
    expect(html({ code: 'several-people' })).toContain('Primero revoca los asientos que sobran');
    expect(html({ code: 'moving' })).toContain('cuando termine, esta cuenta se borra');
    expect(html({ code: 'team-plan' })).not.toContain('Pasa de la pestaña');
  });

  test('⛔ «Guardar» se ofrece solo después de una vista previa que cambia algo: un rechazo o «ya era» no lo ofrecen', () => {
    expect(saveOfferOf(undefined)).toBe('waiting');
    expect(saveOfferOf({ ok: true, preview: TO_PERSONAL })).toBe('ready');
    expect(saveOfferOf({ ok: true, preview: { ...TO_PERSONAL, changed: false } })).toBe('none');
    expect([rejected({ code: 'team-plan' }), rejected({ code: 'moving' }), rejected({ code: 'unavailable' })].map(saveOfferOf)).toEqual(['none', 'none', 'none']);
  });

  test('⛔ mientras llega la vista previa, el diálogo pide un motivo opcional y «Guardar» no se puede oprimir', () => {
    const html = render(AccountTypeDialog, { target: 'personal', companyId: ID, companyTitle: 'Acme', onClose: () => {} });
    expect(html).toContain('¿Pasar Acme a cuenta personal?');
    expect(html).toContain('Revisando si la cuenta puede pasar a cuenta personal…');
    expect(html).toContain('Motivo (opcional)');
    expect(html).not.toMatch(/<textarea[^>]*required/);
    expect(buttonWith(html, 'Guardar')).toContain('disabled=""');
  });
});

describe('CA-14 · los rechazos al guardar y el aviso', () => {
  test('⛔ un corte al guardar dice que repetir es seguro; en la vista previa, que se vuelva a abrir', () => {
    expect(typeRejectionMessage({ code: 'unavailable' }, 'save')).toContain('si ya se hizo, no cambia nada');
    expect(typeRejectionMessage({ code: 'unavailable' }, 'preview')).toContain('cierra el diálogo y vuelve a abrirlo');
    expect(typeRejectionMessage({ code: 'conflict' }, 'save')).toContain('vuelve a oprimir «Guardar»');
  });

  test('los rechazos propios del cambio de tipo usan el texto general, que ya dice qué hacer', () => {
    expect(typeRejectionMessage({ code: 'team-plan' }, 'save')).toBeUndefined();
    expect(rejectionMessage({ code: 'team-plan' })).toContain('«Cambiar plan»');
  });

  test('⛔ el aviso de la ficha dice a qué pestaña pasó, o que no cambió nada', () => {
    expect(typeChangedNotice(typeChangedNoticeParams({ changed: true, kind: { before: 'company', after: 'personal' } })))
      .toBe('La cuenta pasó a cuenta personal. Ahora está en la pestaña «Cuentas personales».');
    expect(typeChangedNotice(typeChangedNoticeParams({ changed: false, kind: { before: 'company', after: 'company' } })))
      .toBe('La cuenta ya era empresa: no cambió nada.');
  });

  test('⛔ el aviso no repite un texto que vino en la dirección', () => {
    for (const aviso of ['<b>hola</b>', 'constructor', 'revocada']) expect(typeChangedNotice(new URLSearchParams({ aviso }))).toBeNull();
  });
});

describe('CA-15 · la historia de la ficha', () => {
  const BODY = {
    historia: [
      { origen: 'auditoria', fecha: '2026-11-27T16:00:00Z', actor: 'equipo:sub-jose', canal: 'panel', que: 'empresas.cambiar-tipo', motivo: 'ahora son tres', antes: { tipo: 'personal' }, despues: { tipo: 'empresa' } },
      { origen: 'cuenta', fecha: '2026-11-27T16:00:00Z', actor: 'equipo-enso', que: 'tipo-de-cuenta', motivo: 'cambiada desde el panel de ENSŌ', detalle: { de: 'personal', a: 'empresa' } },
      { origen: 'auditoria', fecha: '2026-11-27T15:00:00Z', actor: 'equipo:sub-jose', canal: 'panel', que: 'empresas.cambiar-tipo', motivo: 'es de una sola persona', antes: { tipo: 'empresa' }, despues: { tipo: 'personal' } },
      { origen: 'cuenta', fecha: '2026-11-27T15:00:00Z', actor: 'equipo-enso', que: 'tipo-de-cuenta', motivo: 'cambiada desde el panel de ENSŌ', detalle: { de: 'empresa', a: 'personal' } },
      { origen: 'cuenta', fecha: '2026-11-01T15:00:00Z', actor: null, que: 'tipo-de-cuenta' },
    ],
  };

  test('⛔ el cambio de tipo se nombra por su dirección, de los dos lados; sin dirección, no se adivina', async () => {
    expect((await historyOf(BODY)).map((e) => e.kind)).toEqual(['account-to-company', 'account-to-company', 'account-to-personal', 'account-to-personal', null]);
  });

  test('⛔ la historia dice «Pasó a cuenta personal» con el motivo real de la auditoría y el tipo de antes y de después', async () => {
    const html = render(CompanyHistoryCard, { history: await historyOf(BODY) });
    expect(html).toContain('<strong>Pasó a cuenta personal</strong> <code>empresas.cambiar-tipo</code>');
    expect(html).toContain('equipo:sub-jose · es de una sola persona');
    expect(html).toContain('tipo: empresa → personal');
    expect(html).toContain('<strong>Pasó a empresa</strong> <code>tipo-de-cuenta</code>');
  });
});
