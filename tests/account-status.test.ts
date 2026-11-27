// Revocar y reactivar una cuenta entera desde su ficha (spec «Revocar y reactivar una cuenta», CA-11 a CA-15).
//
// EL DEFECTO QUE PREVIENE. Que alguien que no es superadministrador vea o mande revocar —le cortaría todo a todas las
// personas de una cuenta—; que se ofrezca revocar una cuenta que Stripe puede cobrar (seguiría cobrando sin acceso y
// nadie lo vería); que el panel le mande al backend sus nombres en inglés, que la vista previa no lleve `soloVer` (y
// revoque al abrir el diálogo) o que revocar no lleve el id escrito (y no se pueda confirmar); que reactivar se ofrezca
// sin haber visto a qué estado vuelve; que un rechazo se pierda o deje el diálogo sin botón; que el aviso de la ficha
// repita un texto que vino en la dirección; y que la historia calle quién revocó, cuándo y por qué.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { accountStatusOffer, type AccountStatusOffer, type AccountStatusResult } from '../app/domain/account-status';
import type { CompanyFile } from '../app/domain/companies';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { accessFor, allows } from '../app/shared/routing/route-access';
import { isStatusPreview, previewAllowsConfirm, readStatusChange, type StatusAnswer } from '../app/modules/companies/account-status-form-data';
import { statusChangedNotice, statusChangedNoticeParams, statusRejectionMessage } from '../app/modules/companies/account-status-labels';
import { planChangeBlock } from '../app/domain/plan-change';
import { teamMember } from './helpers/fake-admin-api';

const changeAccountStatus = vi.fn();
const read = { getCompany: vi.fn(), getCompanyHistory: vi.fn(), getVoiceCaps: vi.fn(), getCompanyHouse: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeAccountStatus }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const statusRoute = await import('../app/modules/companies/routes/company-status');
const companyRoute = await import('../app/modules/companies/routes/company');
const { AccountStatusPreview } = await import('../app/modules/companies/components/account-status-preview');
const { AccountStatusDialog } = await import('../app/modules/companies/components/account-status-dialog');
const { CompanyHistoryCard } = await import('../app/modules/companies/components/company-history-card');

const ID = 'acme-1a2b3c';
const jose = teamMember('jose', { isSuperadmin: true });
/** Todo lo de Empresas y Usuarios, sin ser superadministradora. */
const ana = teamMember('ana', { permissions: { companies: 'edit', clientUsers: 'edit' } });

const FILE: CompanyFile = {
  id: ID, name: 'Acme', kind: 'company', person: null, origin: null, plan: 'custom', status: 'active',
  expiry: { expired: false, expiredBy: null, until: null }, notice: null, seats: { used: 3, cap: 5 }, admins: 1,
  paysWithStripe: false, stripeCanCharge: false, createdAt: '2026-10-01T00:00:00Z', effectivePlan: null,
  conditions: null, access: null, accessPending: null,
};
const REVOKED: CompanyFile = { ...FILE, status: 'revoked' };

/** La respuesta 200 del contrato: la vista previa de reactivar una cuenta que estaba vencida. */
const REACTIVATE_BODY = { tenantId: ID, accion: 'reactivar', soloVer: true, cambio: true, estado: { antes: 'revoked', despues: 'canceled' }, personas: 4 };
const REACTIVATE_PREVIEW: AccountStatusResult = { action: 'reactivate', previewOnly: true, changed: true, status: { before: 'revoked', after: 'canceled' }, people: 4 };
const REVOKE_SAVED: AccountStatusResult = { action: 'revoke', previewOnly: false, changed: true, status: { before: 'active', after: 'revoked' }, people: 4 };

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

const post = (fields: Record<string, string>) => statusRoute.action({
  request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}/status`, { method: 'POST', body: formOf(fields) }),
  context: contextOf(jose), params: { companyId: ID },
} as never);

const openFile = (member: TeamMember) =>
  companyRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);

function render<P extends object>(Component: ComponentType<P>, props: P, at = `/companies/${ID}`) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

/** La ficha como la ve el superadministrador (o quien sea, con `statusAction: null`). */
const renderFile = (file: CompanyFile, statusAction: AccountStatusOffer | null = accountStatusOffer(file)) => render(companyRoute.default as ComponentType<object>, {
  loaderData: {
    file, history: [], canSeePeople: false, canDelete: statusAction !== null, canChangePlan: false, planBlock: planChangeBlock(file),
    statusAction, voiceCap: null, house: null, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false },
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

beforeEach(() => {
  changeAccountStatus.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
  read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
  read.getVoiceCaps.mockResolvedValue({ kind: 'ok', value: { general: { usd: 10 }, exceptions: [] } });
  read.getCompanyHouse.mockResolvedValue({ kind: 'ok', value: { pause: null, frozenLots: [] } });
});

describe('CA-11 · quién ve «Revocar cuenta» y «Reactivar cuenta», y cuándo', () => {
  test('⛔ la ficha los ofrece solo al superadministrador: «editar» en Empresas no alcanza', async () => {
    read.getCompany.mockResolvedValue({ kind: 'ok', value: FILE });
    expect([(await openFile(jose)).statusAction, (await openFile(ana)).statusAction]).toEqual([{ action: 'revoke', blocked: null }, null]);
  });

  test('⛔ la ruta que revoca y reactiva es solo del superadministrador', () => {
    const access = accessFor(new URL(`https://dxxxx.cloudfront.net/companies/${ID}/status`));
    expect(access).toBe('superadmin');
    expect([allows(ana, access!), allows(jose, access!)]).toEqual([false, true]);
  });

  test('⛔ una cuenta revocada ofrece reactivar en lugar de revocar; una que Stripe puede cobrar no se revoca', () => {
    expect(accountStatusOffer(REVOKED)).toEqual({ action: 'reactivate', blocked: null });
    expect(accountStatusOffer({ ...FILE, stripeCanCharge: true })).toEqual({ action: 'revoke', blocked: 'charging' });
    // Revocada, lo que Stripe pueda cobrar con el estado que recuperaría lo dice el backend en la vista previa (decisión 6).
    expect(accountStatusOffer({ ...REVOKED, stripeCanCharge: true })).toEqual({ action: 'reactivate', blocked: null });
  });

  test('⛔ «Revocar cuenta» va junto a «Borrar cuenta»; en una revocada, «Reactivar cuenta» en su lugar', () => {
    const activa = renderFile(FILE);
    expect(activa).toMatch(/>Revocar cuenta<\/button><a class="btn" href="\/companies\/acme-1a2b3c\/delete"[^>]*>Borrar cuenta<\/a>/);
    expect(activa).not.toContain('Reactivar cuenta');
    const revocada = renderFile(REVOKED);
    expect(revocada).toContain('>Reactivar cuenta</button>');
    expect(revocada).not.toContain('Revocar cuenta');
  });

  test('⛔ quien no es superadministrador no ve ninguno de los dos', () => {
    const html = renderFile(FILE, null);
    expect(html).not.toContain('Revocar cuenta');
    expect(html).not.toContain('Reactivar cuenta');
  });

  test('⛔ CA-12: si Stripe puede cobrar, «Revocar cuenta» está desactivado y dice por qué a la vista', () => {
    const html = renderFile({ ...FILE, stripeCanCharge: true });
    expect(buttonWith(html, 'Revocar cuenta')).toBe('<button type="button" class="btn" disabled="" aria-describedby="status-block-reason">Revocar cuenta</button>');
    expect(html).toMatch(/<p id="status-block-reason">«Revocar cuenta» no está disponible\. [^<]*primero hay que cancelarla en Stripe/);
  });
});

describe('CA-12 y CA-13 · el pedido y su respuesta', () => {
  test('⛔ va por POST en los nombres del backend: la vista previa lleva `soloVer` y nada más; revocar, el id escrito; reactivar, nunca `confirmo`', async () => {
    const { api, seen } = writeApiAnswering(() => Response.json(REACTIVATE_BODY));
    const r = await api.changeAccountStatus('t', ID, { action: 'reactivate', reason: null, confirmation: null, previewOnly: true });
    await api.changeAccountStatus('t', ID, { action: 'revoke', reason: null, confirmation: null, previewOnly: true });
    await api.changeAccountStatus('t', ID, { action: 'revoke', reason: 'dejó de pagar la factura', confirmation: ID, previewOnly: false });
    await api.changeAccountStatus('t', ID, { action: 'reactivate', reason: 'pagó', confirmation: null, previewOnly: false });
    const url = `https://api.example/v1/admin/clientes/${ID}/estado`;
    expect(seen).toEqual([
      { url, method: 'POST', body: { accion: 'reactivar', soloVer: true } },
      { url, method: 'POST', body: { accion: 'revocar', soloVer: true } },
      { url, method: 'POST', body: { accion: 'revocar', motivo: 'dejó de pagar la factura', confirmo: ID } },
      { url, method: 'POST', body: { accion: 'reactivar', motivo: 'pagó' } },
    ]);
    expect(r).toEqual({ kind: 'ok', value: REACTIVATE_PREVIEW });
  });

  test('revocar sin nada escrito manda `confirmo` vacío: el backend responde «confirmación», no un pedido a medias', async () => {
    const { api, seen } = writeApiAnswering(() => Response.json({ ...REACTIVATE_BODY, accion: 'revocar' }));
    await api.changeAccountStatus('t', ID, { action: 'revoke', reason: 'x', confirmation: null, previewOnly: false });
    expect(seen[0]?.body).toEqual({ accion: 'revocar', motivo: 'x', confirmo: '' });
  });

  test('⛔ una respuesta con una acción que el panel no conoce rompe el contrato: no se muestra como si fuera otra', async () => {
    const { api } = writeApiAnswering(() => Response.json({ ...REACTIVATE_BODY, accion: 'suspender' }));
    await expect(api.changeAccountStatus('t', ID, { action: 'reactivate', reason: null, confirmation: null, previewOnly: true })).rejects.toBeInstanceOf(ApiContractError);
  });

  test('⛔ cada rechazo del contrato vuelve como rechazo, con los nombres del panel', async () => {
    const casos: [number, object, object][] = [
      [404, { codigo: 'no-existe' }, { code: 'not-found' }],
      [422, { codigo: 'invalido', error: 'el motivo es obligatorio' }, { code: 'invalid', message: 'el motivo es obligatorio', field: null }],
      [422, { codigo: 'confirmacion' }, { code: 'confirmation' }],
      [409, { codigo: 'cuenta-con-cobro' }, { code: 'account-charging' }],
      [409, { codigo: 'conflicto' }, { code: 'conflict' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { api } = writeApiAnswering(() => Response.json(body, { status }));
      expect(await api.changeAccountStatus('t', ID, { action: 'revoke', reason: 'x', confirmation: ID, previewOnly: false })).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });
});

describe('CA-12 a CA-14 · la ruta de los diálogos', () => {
  test('⛔ la vista previa llega a la API sin motivo ni confirmación, y vuelve al diálogo sin escribir', async () => {
    changeAccountStatus.mockResolvedValue({ kind: 'ok', value: REACTIVATE_PREVIEW });
    expect(await post({ change: 'reactivate', intent: 'preview' })).toEqual({ ok: true, preview: REACTIVATE_PREVIEW });
    expect(changeAccountStatus).toHaveBeenCalledWith('token', ID, { action: 'reactivate', reason: null, confirmation: null, previewOnly: true });
  });

  test('⛔ el motivo es opcional: guardar sin él llega a la API sin motivo', async () => {
    changeAccountStatus.mockResolvedValue({ kind: 'ok', value: REVOKE_SAVED });
    await post({ change: 'revoke', intent: 'save', reason: '   ', confirmation: ID });
    expect(changeAccountStatus).toHaveBeenCalledWith('token', ID, { action: 'revoke', reason: null, confirmation: ID, previewOnly: false });
  });

  test('⛔ un motivo de más de 500 caracteres se dice junto al campo y no llega a la API', async () => {
    expect(await post({ change: 'revoke', intent: 'save', reason: 'x'.repeat(501), confirmation: ID })).toMatchObject({ errors: { reason: 'El motivo va hasta 500 caracteres.' } });
    expect(changeAccountStatus).not.toHaveBeenCalled();
  });

  test('⛔ revocar manda el motivo y el id escrito, y vuelve a la ficha con el aviso', async () => {
    changeAccountStatus.mockResolvedValue({ kind: 'ok', value: REVOKE_SAVED });
    const r = (await post({ change: 'revoke', intent: 'save', reason: ' dejó de pagar ', confirmation: ID })) as Response;
    expect(changeAccountStatus).toHaveBeenCalledWith('token', ID, { action: 'revoke', reason: 'dejó de pagar', confirmation: ID, previewOnly: false });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}?aviso=revocada&estado=revoked`);
  });

  test('⛔ un rechazo se queda en el diálogo con su porqué', async () => {
    changeAccountStatus.mockResolvedValue({ kind: 'rejected', rejection: { code: 'confirmation' }, createdAccountId: null });
    expect(await post({ change: 'revoke', intent: 'save', reason: 'x', confirmation: 'acme' })).toEqual({ ok: false, rejection: { code: 'confirmation' }, errors: {} });
  });

  test('un pedido que no es revocar ni reactivar no llega a la API', async () => {
    expect(await post({ change: 'delete', intent: 'save', reason: 'x' })).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    expect(await post({ change: 'revoke', intent: 'otra' })).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    expect(changeAccountStatus).not.toHaveBeenCalled();
  });

  test('reactivar no lleva el id aunque venga en el formulario', () => {
    expect(readStatusChange(formOf({ change: 'reactivate', intent: 'save', reason: 'pagó', confirmation: ID }))).toEqual({ change: { action: 'reactivate', reason: 'pagó', confirmation: null, previewOnly: false } });
  });

  test('⛔ la vista previa no vuelve a pedir la ficha; guardar, sí', () => {
    const args = (fields: Record<string, string>) => ({ formData: formOf(fields), defaultShouldRevalidate: true }) as never;
    expect(isStatusPreview(formOf({ change: 'revoke', intent: 'preview' }))).toBe(true);
    expect(companyRoute.shouldRevalidate(args({ change: 'revoke', intent: 'preview' }))).toBe(false);
    expect(companyRoute.shouldRevalidate(args({ change: 'revoke', intent: 'save' }))).toBe(true);
  });
});

describe('CA-12 y CA-13 · lo que dice el diálogo', () => {
  const preview = (props: Parameters<typeof AccountStatusPreview>[0]) => render(AccountStatusPreview, props);

  test('⛔ revocar dice qué pasa: nadie entra, las 72 horas, cuántas personas y que no quedan libres', () => {
    const html = preview({ action: 'revoke', answer: { ok: true, preview: { ...REVOKE_SAVED, previewOnly: true } }, introId: 'i' });
    for (const text of ['Nadie de la cuenta puede volver a entrar a ENSŌ.', 'a las 72 horas', '4 personas pierden el acceso.', 'no quedan libres para entrar a otra empresa']) {
      expect(html).toContain(text);
    }
  });

  test('⛔ reactivar dice a qué estado vuelve, en palabras, y cuántas personas recuperan el acceso', () => {
    const html = preview({ action: 'reactivate', answer: { ok: true, preview: { ...REACTIVATE_PREVIEW, people: 1 } }, introId: 'i' });
    expect(html).toContain('Vuelve a «Vencida (recibe Free)».');
    expect(html).toContain('1 persona recupera el acceso');
  });

  test('un rechazo de la vista previa se dice en el contexto de esta acción', () => {
    const html = preview({ action: 'reactivate', answer: { ok: false, rejection: { code: 'account-charging' }, errors: {} }, introId: 'i' });
    expect(html).toContain('reactívala por comando');
  });

  test('⛔ el diálogo de revocar pide el id exacto (el motivo es opcional), y no deja confirmar antes de ver qué pasa', () => {
    const html = render(AccountStatusDialog, { action: 'revoke', companyId: ID, companyTitle: 'Acme', onClose: () => {} });
    expect(html).toContain('Motivo (opcional)');
    expect(html).not.toMatch(/<textarea id="status-reason"[^>]*required/);
    expect(html).toContain(`Escribe <span class="mono">${ID}</span> para confirmar`);
    expect(buttonWith(html, 'Revocar cuenta')).toContain('disabled=""');
  });

  test('el diálogo de reactivar no pide escribir el id (decisión 3)', () => {
    const html = render(AccountStatusDialog, { action: 'reactivate', companyId: ID, companyTitle: 'Acme', onClose: () => {} });
    expect(html).not.toContain('para confirmar');
  });

  test('⛔ se confirma solo con una vista previa que cambia algo, o un rechazo que guardar no repetiría', () => {
    const rejected = (code: 'account-charging' | 'not-found' | 'unavailable'): StatusAnswer => ({ ok: false, rejection: { code } as never, errors: {} });
    expect(previewAllowsConfirm(undefined)).toBe(false);
    expect(previewAllowsConfirm({ ok: true, preview: REACTIVATE_PREVIEW })).toBe(true);
    expect(previewAllowsConfirm({ ok: true, preview: { ...REACTIVATE_PREVIEW, changed: false } })).toBe(false);
    expect([rejected('account-charging'), rejected('not-found'), rejected('unavailable')].map(previewAllowsConfirm)).toEqual([false, false, true]);
  });
});

describe('CA-14 · los rechazos y el aviso', () => {
  test('⛔ el cobro de Stripe se explica distinto al revocar y al reactivar; un corte al guardar dice que repetir es seguro', () => {
    expect(statusRejectionMessage({ code: 'account-charging' }, 'revoke', 'save')).toContain('primero hay que cancelarla en Stripe');
    expect(statusRejectionMessage({ code: 'account-charging' }, 'reactivate', 'save')).toContain('reactívala por comando');
    expect(statusRejectionMessage({ code: 'unavailable' }, 'revoke', 'save')).toContain('si ya se hizo, no cambia nada');
    expect(statusRejectionMessage({ code: 'confirmation' }, 'revoke', 'save')).toBeUndefined();
  });

  test('⛔ el aviso de la ficha nombra el estado al que volvió', () => {
    const params = statusChangedNoticeParams({ action: 'reactivate', changed: true, status: { before: 'revoked', after: 'canceled' } });
    expect(statusChangedNotice(params)).toBe('Cuenta reactivada: volvió a «Vencida (recibe Free)». Sus personas vuelven a entrar la próxima vez que ENSŌ sincronice.');
    expect(statusChangedNotice(statusChangedNoticeParams({ ...REVOKE_SAVED, changed: false }))).toBe('La cuenta ya estaba revocada: no cambió nada.');
  });

  test('⛔ el aviso no repite un estado que vino en la dirección y el panel no conoce', () => {
    for (const estado of ['<b>hola</b>', 'constructor', 'toString']) {
      expect(statusChangedNotice(new URLSearchParams({ aviso: 'reactivada', estado }))).toBe('Cuenta reactivada. Sus personas vuelven a entrar la próxima vez que ENSŌ sincronice.');
    }
    expect(statusChangedNotice(new URLSearchParams({ aviso: 'otra' }))).toBeNull();
  });
});

describe('CA-15 · la historia de la ficha', () => {
  const HISTORY_BODY = {
    historia: [
      { origen: 'auditoria', fecha: '2026-11-26T15:00:00Z', actor: 'equipo:sub-jose', canal: 'panel', que: 'empresas.reactivar', motivo: 'pagó la factura', antes: { estado: 'revoked' }, despues: { estado: 'active' } },
      { origen: 'cuenta', fecha: '2026-11-26T15:00:00Z', actor: 'equipo-enso', que: 'reactivado', motivo: 'reactivada desde el panel de ENSŌ' },
      { origen: 'auditoria', fecha: '2026-11-20T15:00:00Z', actor: 'equipo:sub-jose', canal: 'panel', que: 'empresas.revocar', motivo: 'no pagó', antes: { estado: 'active' }, despues: { estado: 'revoked' } },
      { origen: 'cuenta', fecha: '2026-11-20T15:00:00Z', actor: 'equipo-enso', que: 'revocado', motivo: 'revocada desde el panel de ENSŌ', detalle: { estadoAnterior: 'active' } },
      { origen: 'cuenta', fecha: '2026-11-01T15:00:00Z', actor: null, que: 'alta' },
    ],
  };

  test('⛔ los dos eventos de cada lado se nombran igual; los demás quedan sin nombre en palabras', async () => {
    const api = createAdminReadApi({ baseUrl: 'https://api.example', log: () => {}, fetchImpl: (async () => Response.json(HISTORY_BODY)) as unknown as typeof fetch });
    const r = await api.getCompanyHistory('t', ID);
    expect(r.kind === 'ok' && r.value.map((e) => e.kind)).toEqual(['account-reactivated', 'account-reactivated', 'account-revoked', 'account-revoked', null]);
  });

  test('⛔ la historia dice «Cuenta revocada» con el motivo real de la auditoría y el estado de antes y de después', async () => {
    const api = createAdminReadApi({ baseUrl: 'https://api.example', log: () => {}, fetchImpl: (async () => Response.json(HISTORY_BODY)) as unknown as typeof fetch });
    const r = await api.getCompanyHistory('t', ID);
    if (r.kind !== 'ok') throw new Error('la historia no se leyó');
    const html = render(CompanyHistoryCard, { history: r.value });
    expect(html).toContain('<strong>Cuenta revocada</strong> <code>empresas.revocar</code>');
    expect(html).toContain('equipo:sub-jose · no pagó');
    expect(html).toContain('estado: active → revoked');
    expect(html).toContain('<strong>Cuenta reactivada</strong> <code>reactivado</code>');
    expect(html).not.toContain('<strong>Cuenta revocada</strong> <code>alta</code>');
  });

  test('⛔ la analítica de una persona se nombra por su dirección, de los dos lados; sin dirección, no se adivina', async () => {
    const body = {
      historia: [
        { origen: 'auditoria', fecha: '2026-11-27T15:00:00Z', actor: 'equipo:sub-jose', canal: 'panel', que: 'usuarios.devolver-analitica', motivo: 'lo pidió', antes: { analitica: 'retirada' }, despues: { analitica: 'compartiendo' } },
        { origen: 'cuenta', fecha: '2026-11-27T15:00:00Z', actor: 'equipo-enso', que: 'analitica', detalle: { correo: 'ana@acme.com', retirada: false } },
        { origen: 'auditoria', fecha: '2026-11-26T15:00:00Z', actor: 'equipo:sub-jose', canal: 'panel', que: 'usuarios.retirar-analitica', motivo: 'lo pidió', antes: { analitica: 'compartiendo' }, despues: { analitica: 'retirada' } },
        { origen: 'cuenta', fecha: '2026-11-26T15:00:00Z', actor: 'equipo-enso', que: 'analitica', detalle: { correo: 'ana@acme.com', retirada: true } },
        { origen: 'cuenta', fecha: '2026-11-25T15:00:00Z', actor: null, que: 'analitica' },
      ],
    };
    const api = createAdminReadApi({ baseUrl: 'https://api.example', log: () => {}, fetchImpl: (async () => Response.json(body)) as unknown as typeof fetch });
    const r = await api.getCompanyHistory('t', ID);
    if (r.kind !== 'ok') throw new Error('la historia no se leyó');
    expect(r.value.map((e) => e.kind)).toEqual(['analytics-restored', 'analytics-restored', 'analytics-withdrawn', 'analytics-withdrawn', null]);
    const html = render(CompanyHistoryCard, { history: r.value });
    expect(html).toContain('<strong>Una persona dejó de compartir su uso</strong> <code>usuarios.retirar-analitica</code>');
    expect(html).not.toContain('ana@acme.com');
  });
});
