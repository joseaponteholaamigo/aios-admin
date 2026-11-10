// Borrar una cuenta desde el panel (spec «Borrar cuentas y destrabar personas», CA-23 a CA-27 y CB-20):
// quién llega, qué pide, qué muestra antes de borrar y a dónde vuelve.
//
// EL DEFECTO QUE PREVIENE. Si alguien que no es superadministrador llegara a la confirmación, el panel
// dejaría de negar antes que el backend. Si la vista previa escondiera un sitio que no conoce, diría que
// se borra menos de lo que se borra. Si el botón funcionara sin escribir el id, un clic borraría una
// cuenta. Y si una cuenta que cobra mostrara el botón, Stripe seguiría cobrando por una cuenta borrada.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { DeletionPreview } from '../app/domain/account-deletion';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { accessFor, allows } from '../app/shared/routing/route-access';
import { deletedNotice } from '../app/modules/companies/account-deletion-labels';
import { teamMember } from './helpers/fake-admin-api';

const deleteAccount = vi.fn();
const read = { listCompanies: vi.fn(), listPendingDeletions: vi.fn(), getCompany: vi.fn(), getCompanyHistory: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ deleteAccount }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const { action, shouldRevalidate } = await import('../app/modules/companies/routes/company-delete');
const companiesRoute = await import('../app/modules/companies/routes/companies');
const companyRoute = await import('../app/modules/companies/routes/company');
const { AdminApiUnavailableError } = await import('../app/shared/api/admin-api.server');
const { DeleteAccountForm } = await import('../app/modules/companies/components/delete-account-form');
const { DeletionSummary } = await import('../app/modules/companies/components/deletion-summary');
const { PendingDeletionsNotice } = await import('../app/modules/companies/components/pending-deletions-notice');

const ID = 'acme-1a2b3c';
const PREVIEW: DeletionPreview = {
  company: { id: ID, name: 'Acme', kind: 'company', plan: 'team' },
  people: [{ email: 'ana@acme.com', isAdmin: true, status: 'active' }],
  sites: [{ site: { key: 'record', raw: 'ficha' }, rows: 1 }, { site: { key: 'other', raw: 'sitio-nuevo' }, rows: 3 }, { site: { key: 'stripe', raw: 'stripe' }, rows: 0 }],
  packages: 2,
  charging: false,
  pending: false,
};

const render = (element: ReturnType<typeof createElement>) => {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/companies/${ID}/delete`] }));
};
const confirmButton = (html: string) => html.match(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? null;

function apiAnswering(respond: () => Response) {
  const seen: { url: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
    return respond();
  }) as unknown as typeof fetch;
  return { read: createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), write: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), seen };
}

function post(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-jose', tokens: { accessToken: 'token-jose' } } as unknown as ActiveSession);
  context.set(teamMemberContext, teamMember('jose', { isSuperadmin: true }));
  return action({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}/delete`, { method: 'POST', body }), context, params: { companyId: ID } } as never);
}

beforeEach(() => {
  deleteAccount.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
});

/** Abre una página como `member`: el loader con su sesión y su persona del equipo. */
function open(loader: (args: never) => Promise<unknown>, url: string, member: ReturnType<typeof teamMember>, params: Record<string, string> = {}) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return loader({ request: new Request(url), context, params } as never);
}
const PAGE = { companies: [], page: { page: 1, pages: 1, total: 0, perPage: 50 }, onlySome: false, counts: { companies: { total: 0, plans: {} }, personal: { total: 0, plans: {} } } };
const superadmin = teamMember('jose', { isSuperadmin: true });
const editaEmpresas = teamMember('ana', { permissions: { companies: 'edit', clientUsers: 'edit' } });

describe('quién llega (CA-23)', () => {
  test('⛔ el botón «Borrar cuenta» de la ficha es solo del superadministrador', async () => {
    read.getCompany.mockResolvedValue({ kind: 'ok', value: { id: ID, kind: 'company' } });
    read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
    const abrir = (member: ReturnType<typeof teamMember>) => open(companyRoute.loader as never, `https://dxxxx.cloudfront.net/companies/${ID}`, member, { companyId: ID }) as Promise<{ canDelete: boolean }>;

    expect([(await abrir(superadmin)).canDelete, (await abrir(editaEmpresas)).canDelete]).toEqual([true, false]);
  });

  test('⛔ la confirmación es solo del superadministrador: tener «editar» en Empresas no alcanza', () => {
    const access = accessFor(new URL(`https://dxxxx.cloudfront.net/companies/${ID}/delete`));

    expect(access).toBe('superadmin');
    expect(allows(teamMember('ana', { permissions: { companies: 'edit', clientUsers: 'edit' } }), access!)).toBe(false);
    expect(allows(teamMember('jose', { isSuperadmin: true }), access!)).toBe(true);
  });
});

describe('la API del borrado', () => {
  test('⛔ la vista previa nombra los sitios del panel y conserva los que no conoce, con su nombre del backend', async () => {
    const { read } = apiAnswering(() => Response.json({
      cuenta: { id: ID, nombre: 'Acme', tipo: 'empresa', plan: 'personalizado' },
      personas: [{ correo: 'ana@acme.com', admin: true, estado: 'invitado' }],
      sitios: { ficha: 1, asientos: 1, 'sitio-nuevo': 4 }, paquetes: 2, cobra: true, pendiente: false,
    }));

    const r = await read.getDeletionPreview('t', ID);

    expect(r.kind === 'ok' && r.value).toMatchObject({
      company: { id: ID, kind: 'company', plan: 'custom' },
      people: [{ email: 'ana@acme.com', isAdmin: true, status: 'invited' }],
      sites: [{ site: { key: 'record' }, rows: 1 }, { site: { key: 'seats' }, rows: 1 }, { site: { key: 'other', raw: 'sitio-nuevo' }, rows: 4 }],
      packages: 2, charging: true,
    });
  });

  test('el borrado manda el id escrito y el motivo solo si se dio, y lee de qué tipo era', async () => {
    const { write, seen } = apiAnswering(() => Response.json({ completo: true, borrado: {}, tipo: 'personal' }));
    const r = await write.deleteAccount('t', ID, { confirmation: ID, reason: null });
    await write.deleteAccount('t', ID, { confirmation: ID, reason: 'lo pidió' });

    expect(seen.map((s) => [s.url, s.body])).toEqual([
      [`https://api.example/v1/admin/clientes/${ID}/borrado`, { confirmo: ID }],
      [`https://api.example/v1/admin/clientes/${ID}/borrado`, { confirmo: ID, motivo: 'lo pidió' }],
    ]);
    expect(r).toEqual({ kind: 'ok', value: { kind: 'personal' } });
  });

  test('⛔ cada rechazo del borrado vuelve a la pantalla, el incompleto con lo que falló (CA-27)', async () => {
    const casos: [number, object, object][] = [
      [422, { codigo: 'confirmacion' }, { code: 'confirmation' }],
      [409, { codigo: 'cuenta-con-cobro' }, { code: 'account-charging' }],
      [409, { codigo: 'borrado-en-curso' }, { code: 'deletion-in-progress' }],
      [503, { codigo: 'borrado-incompleto', sitios: ['identidades', 'auditoria'] }, { code: 'deletion-incomplete', sites: [{ key: 'logins', raw: 'identidades' }, { key: 'audit', raw: 'auditoria' }] }],
      [401, { codigo: 'mfa-reciente' }, { code: 'recent-mfa' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { write } = apiAnswering(() => Response.json(body, { status }));
      expect(await write.deleteAccount('t', ID, { confirmation: ID, reason: null })).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });

  test('los pendientes traen el id, desde cuándo y quién lo pidió', async () => {
    const { read } = apiAnswering(() => Response.json({ pendientes: [{ id: ID, empezoEl: '2026-11-10T15:00:00.000Z', pedidoPor: 'equipo:sub-jose' }] }));

    expect(await read.listPendingDeletions('t')).toEqual({ kind: 'ok', value: [{ id: ID, startedAt: '2026-11-10T15:00:00.000Z', requestedBy: 'equipo:sub-jose' }] });
  });
});

describe('la acción de la confirmación', () => {
  test('⛔ al terminar vuelve a Empresas con el aviso, a la pestaña de su tipo (CA-25)', async () => {
    deleteAccount.mockResolvedValueOnce({ kind: 'ok', value: { kind: 'company' } }).mockResolvedValueOnce({ kind: 'ok', value: { kind: 'personal' } });

    const empresa = (await post({ confirmation: ID, reason: '' })) as Response;
    const personal = (await post({ confirmation: ID, reason: 'lo pidió' })) as Response;

    expect(deleteAccount).toHaveBeenNthCalledWith(1, 'token-jose', ID, { confirmation: ID, reason: null });
    expect([empresa.headers.get('Location'), personal.headers.get('Location')]).toEqual([`/companies?borrada=${ID}`, `/companies?kind=personal&borrada=${ID}`]);
    expect(deletedNotice(new URL(`https://x${personal.headers.get('Location')}`).searchParams)).toBe(`Se borró la cuenta ${ID}.`);
  });

  test('un rechazo se queda en la pantalla con lo escrito (CB-20)', async () => {
    deleteAccount.mockResolvedValue({ kind: 'rejected', rejection: { code: 'unavailable' }, createdAccountId: null });

    expect(await post({ confirmation: ID, reason: 'lo pidió' })).toEqual({ values: { confirmation: ID, reason: 'lo pidió' }, rejection: { code: 'unavailable' } });
  });
});

describe('lo que se ve', () => {
  test('⛔ el botón está apagado hasta que lo escrito sea el id exacto (CA-24)', () => {
    const sin = confirmButton(render(createElement(DeleteAccountForm, { preview: PREVIEW, values: null, rejection: null })));
    const conOtro = confirmButton(render(createElement(DeleteAccountForm, { preview: PREVIEW, values: { confirmation: ID.toUpperCase(), reason: '' }, rejection: null })));
    const conElId = confirmButton(render(createElement(DeleteAccountForm, { preview: PREVIEW, values: { confirmation: ID, reason: '' }, rejection: null })));

    expect([sin, conOtro].every((b) => b?.includes('disabled'))).toBe(true);
    expect(conElId).not.toContain('disabled');
    expect(conElId).toContain('Borrar cuenta');
  });

  test('⛔ una cuenta que cobra no muestra el botón y dice que primero se cancela en Stripe (CA-26)', () => {
    const html = render(createElement(DeleteAccountForm, { preview: { ...PREVIEW, charging: true }, values: null, rejection: null }));

    expect(confirmButton(html)).toBeNull();
    expect(html).toContain('Primero hay que cancelarla en Stripe');
  });

  test('un borrado a medias se ofrece como «Terminar el borrado», y dice qué falló (CA-27)', () => {
    const pendiente = render(createElement(DeleteAccountForm, { preview: { ...PREVIEW, pending: true }, values: null, rejection: null }));
    const incompleto = render(createElement(DeleteAccountForm, {
      preview: PREVIEW, values: null, rejection: { code: 'deletion-incomplete', sites: [{ key: 'logins', raw: 'identidades' }] },
    }));

    expect(confirmButton(pendiente)).toContain('Terminar el borrado');
    expect(incompleto).toContain('Falló en: Los logins de sus personas');
  });

  test('un 404 al borrar dice que puede que el borrado anterior ya haya terminado (CB-20)', () => {
    const html = render(createElement(DeleteAccountForm, { preview: PREVIEW, values: null, rejection: { code: 'not-found' } }));

    expect(html).toContain('puede que un borrado anterior haya terminado');
  });

  test('⛔ la vista previa muestra las personas, los sitios con filas y uno que el panel no conoce (CA-24)', () => {
    const html = render(createElement(DeletionSummary, { preview: PREVIEW }));

    expect(html).toContain('ana@acme.com');
    expect(html).toContain('La ficha de la cuenta');
    expect(html).toContain('sitio-nuevo');
    expect(html).not.toContain('El vínculo con Stripe');
    expect(html).toContain('Los paquetes de su equipo');
  });

  test('Empresas avisa de los borrados sin terminar, con un enlace a cada uno (CA-27)', () => {
    const html = render(createElement(PendingDeletionsNotice, { pending: [{ id: ID, startedAt: null, requestedBy: null }] }));

    expect(html).toContain('Hay borrados sin terminar');
    expect(html).toContain(`href="/companies/${ID}/delete"`);
    expect(render(createElement(PendingDeletionsNotice, { pending: [] }))).toBe('');
  });
});

describe('después de un rechazo (CB-20)', () => {
  const args = (code: string) => ({ actionResult: { values: {}, rejection: { code } }, defaultShouldRevalidate: true }) as never;

  test('⛔ tras un 404 o una API caída no vuelve a pedir la vista previa: la página de error taparía lo que se explica', () => {
    expect([shouldRevalidate(args('not-found')), shouldRevalidate(args('unavailable'))]).toEqual([false, false]);
  });

  test('tras un borrado a medias o una cuenta que empezó a cobrar, sí: la pantalla tiene que mostrar cómo quedó', () => {
    expect([shouldRevalidate(args('deletion-incomplete')), shouldRevalidate(args('account-charging'))]).toEqual([true, true]);
  });
});

describe('Empresas y los borrados sin terminar (CA-27)', () => {
  const abrir = (member: ReturnType<typeof teamMember>) => open(companiesRoute.loader as never, 'https://dxxxx.cloudfront.net/companies', member) as Promise<{ pendingDeletions: unknown[] }>;
  beforeEach(() => read.listCompanies.mockResolvedValue({ kind: 'ok', value: PAGE }));

  test('el superadministrador ve los pendientes; quien no lo es, nunca los pide', async () => {
    read.listPendingDeletions.mockResolvedValue({ kind: 'ok', value: [{ id: ID, startedAt: null, requestedBy: null }] });

    expect((await abrir(superadmin)).pendingDeletions).toEqual([{ id: ID, startedAt: null, requestedBy: null }]);
    expect((await abrir(editaEmpresas)).pendingDeletions).toEqual([]);
    expect(read.listPendingDeletions).toHaveBeenCalledTimes(1);
  });

  test('si los pendientes no responden, la lista sigue sin el aviso', async () => {
    read.listPendingDeletions.mockRejectedValue(new AdminApiUnavailableError('caído'));

    expect((await abrir(superadmin)).pendingDeletions).toEqual([]);
  });

  test('⛔ un error del código al pedir los pendientes no se esconde: el aviso no puede desaparecer en silencio', async () => {
    read.listPendingDeletions.mockRejectedValue(new TypeError('listPendingDeletions is not a function'));

    await expect(abrir(superadmin)).rejects.toBeInstanceOf(TypeError);
  });

  test('el aviso de borrado repite solo un id de cuenta, no cualquier texto de la dirección', () => {
    expect(deletedNotice(new URLSearchParams({ borrada: ID }))).toBe(`Se borró la cuenta ${ID}.`);
    expect(deletedNotice(new URLSearchParams({ borrada: 'Te hackeamos, escribe a x@y.co' }))).toBeNull();
  });
});
