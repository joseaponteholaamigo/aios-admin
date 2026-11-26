// Cambiar el rol, reenviar la invitación y revocar el acceso de una persona desde el panel (spec «Editar
// cuentas y personas», CA-24 a CA-26, CA-29 y CA-30).
//
// EL DEFECTO QUE PREVIENE. Que el menú ofrezca una acción que el backend negará (revocar sin ser
// superadministrador, reenviar a quien ya entró, cambiar el rol en una cuenta personal); que la acción
// llegue a la API sin el permiso que pide; que «Cambiar rol» mande lo que no cambió (y la auditoría anote un
// cambio que no hubo) o deje «sin rol» cuando se quería otro; que el correo viaje en la dirección; que un
// rechazo nuevo del backend se lea como «la API no responde»; y que revocar no avise que no tiene vuelta.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ClientPerson } from '../app/domain/client-users';
import type { TeamMember } from '../app/domain/permissions';
import { personActionsFor, type PersonActionRequest } from '../app/domain/person-actions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { readPersonAction } from '../app/shared/person-actions/person-action-form-data';
import { personActionNotice, personActionNoticeParams } from '../app/shared/person-actions/person-action-labels';
import { teamMember } from './helpers/fake-admin-api';

const personAction = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ personAction }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({}) }));
const { action } = await import('../app/modules/client-users/routes/company-people');
const { PeoplePanel } = await import('../app/modules/client-users/components/people-panel');
const { PersonActionDialog } = await import('../app/shared/person-actions/person-action-dialog');
const { ChangeRoleFields } = await import('../app/modules/client-users/components/change-role-fields');

const COMPANY = 'acme-1a2b3c';
const jose = teamMember('jose', { isSuperadmin: true });
const editora = teamMember('ana', { permissions: { clientUsers: 'edit' } });
const lectora = teamMember('luz', { permissions: { clientUsers: 'view', companies: 'edit' } });

const SUPERADMIN = { superadmin: true, editUsers: true };
const EDITORA = { superadmin: false, editUsers: true };

const persona = (extra: Partial<ClientPerson> = {}): ClientPerson => ({
  email: 'beto@acme.com', role: 'ventas', isAdmin: false, status: 'active', sees: { kind: 'role', role: 'ventas', adjustments: 0 },
  counts: { skills: 0, agents: 0, chains: 0 }, invitedAt: null, acceptedAt: null, ...extra,
});
const ROLES = [
  { slug: 'ventas', label: 'Ventas', base: 'company' as const, empty: false, people: 1, rules: 0 },
  { slug: 'soporte', label: 'Soporte', base: 'company' as const, empty: false, people: 0, rules: 0 },
];

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function post(fields: Record<string, string>, member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  const request = new Request(`https://dxxxx.cloudfront.net/client-users/${COMPANY}`, { method: 'POST', body: formOf(fields) });
  return action({ request, context, params: { companyId: COMPANY } } as never);
}

const render = (element: ReturnType<typeof createElement>) => {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/client-users/${COMPANY}`] }));
};

const CAMBIO_DE_ROL = { intent: 'change-role', email: 'beto@acme.com', currentRole: 'ventas', currentAdmin: 'false', role: 'soporte', reason: '' };

beforeEach(() => personAction.mockReset());

describe('CA-24 · qué ofrece el menú de cada persona', () => {
  test('⛔ «editar» en Usuarios cambia el rol y reenvía; revocar y destrabar son del superadministrador', () => {
    expect(personActionsFor('invited', false, EDITORA)).toEqual(['change-role', 'resend-invitation']);
    expect(personActionsFor('invited', false, SUPERADMIN)).toEqual(['change-role', 'resend-invitation', 'reset-mfa', 'delete-login', 'revoke', 'delete-person']);
    expect(personActionsFor('active', false, { superadmin: false, editUsers: false })).toEqual([]);
  });

  test('⛔ reenviar solo a quien todavía no entró; cambiar el rol y revocar, solo con el asiento vivo', () => {
    expect(personActionsFor('active', false, SUPERADMIN)).not.toContain('resend-invitation');
    expect(personActionsFor('paused', false, SUPERADMIN)).toEqual(['change-role', 'reset-mfa', 'delete-login', 'revoke', 'delete-person']);
    expect(personActionsFor('revoked', false, SUPERADMIN)).toEqual(['reset-mfa', 'delete-login', 'delete-person']);
  });

  test('⛔ en una cuenta personal no aparece ninguna de las tres', () => {
    expect(personActionsFor('invited', true, SUPERADMIN)).toEqual(['reset-mfa', 'delete-login']);
    expect(personActionsFor('invited', true, EDITORA)).toEqual([]);
  });

  test('el menú de la tabla muestra «Reenviar invitación» solo en la persona invitada', () => {
    const html = render(createElement(PeoplePanel, {
      people: [persona(), persona({ email: 'eva@acme.com', status: 'invited' })], roles: ROLES, companyId: COMPANY, companyName: 'Acme',
      personal: false, actor: EDITORA, lastAttempt: null, credits: { canSee: false, canLoad: false },
    }));
    expect(html.match(/>Cambiar rol</g)).toHaveLength(2);
    expect(html.match(/>Reenviar invitación</g)).toHaveLength(1);
    expect(html).not.toContain('Revocar acceso');
  });
});

describe('la acción de la página de personas', () => {
  test('⛔ con «editar» en Usuarios cambia el rol: solo lo que cambió, a la cuenta de la dirección, y vuelve con el aviso sin el correo', async () => {
    personAction.mockResolvedValue({ kind: 'ok', value: { action: 'change-role', appUnlinked: null, noticeEmail: null } });
    const r = (await post(CAMBIO_DE_ROL, editora)) as Response;
    expect(personAction).toHaveBeenCalledWith('token', COMPANY, { action: 'change-role', email: 'beto@acme.com', reason: '', change: { role: 'soporte' } });
    expect(r.headers.get('Location')).toBe(`/client-users/${COMPANY}?persona=rol-cambiado`);
  });

  test('⛔ revocar sin ser superadministrador es 403, y no llega a la API', async () => {
    await expect(post({ intent: 'revoke', email: 'beto@acme.com', reason: '' }, editora)).rejects.toMatchObject({ init: { status: 403 } });
    expect(personAction).not.toHaveBeenCalled();
  });

  test('⛔ sin «editar» en Usuarios ni cambiar el rol: 403, aunque edite Empresas', async () => {
    await expect(post(CAMBIO_DE_ROL, lectora)).rejects.toMatchObject({ init: { status: 403 } });
    expect(personAction).not.toHaveBeenCalled();
  });

  test('un rechazo vuelve con el intento entero, para reabrir el diálogo con lo escrito (CA-29)', async () => {
    personAction.mockResolvedValue({ kind: 'rejected', rejection: { code: 'last-admin' }, createdAccountId: null });
    const r = await post({ intent: 'revoke', email: 'ana@acme.com', reason: 'lo pidió el admin' }, jose);
    expect(r).toEqual({ attempt: { action: 'revoke', email: 'ana@acme.com', reason: 'lo pidió el admin' }, rejection: { code: 'last-admin' } });
  });
});

describe('CA-25 · lo que manda «Cambiar rol»', () => {
  const leer = (fields: Record<string, string>) => readPersonAction(formOf({ ...CAMBIO_DE_ROL, ...fields }));

  test('⛔ manda solo lo que cambió, y un rol vacío es «sin rol»', () => {
    expect(leer({ role: 'ventas', isAdmin: 'on' })).toMatchObject({ request: { change: { isAdmin: true } } });
    expect(leer({ role: '' })).toMatchObject({ request: { change: { role: null } } });
    expect(leer({ role: 'soporte', isAdmin: 'on' })).toMatchObject({ request: { change: { role: 'soporte', isAdmin: true } } });
  });

  test('⛔ sin nada que cambiar no llega a la API: vuelve al diálogo diciéndolo', () => {
    expect(leer({ role: 'ventas' })).toMatchObject({ rejection: { code: 'invalid', message: expect.stringContaining('no cambiaste nada') } });
  });

  test('el diálogo trae los roles de la empresa y «sin rol», con lo de hoy puesto, la casilla de admin y el motivo', () => {
    const html = render(createElement(PersonActionDialog, { action: 'change-role', email: 'beto@acme.com', companyName: 'Acme', rejection: null, onClose: () => {} },
      createElement(ChangeRoleFields, { person: persona({ isAdmin: true }), roles: ROLES, reason: '' })));
    expect(html).toMatch(/<option value="">Sin rol<\/option><option value="ventas" selected="">Ventas<\/option><option value="soporte">Soporte<\/option>/);
    expect(html).toMatch(/<input type="checkbox" name="isAdmin" checked=""/);
    expect(html).toContain('<input type="hidden" name="currentRole" value="ventas"/>');
    expect(html).toContain('<input type="hidden" name="currentAdmin" value="true"/>');
    expect(html).toContain('Motivo (opcional)');
    // CA-30: el botón que manda es el compartido, que se bloquea mientras espera.
    expect(html).toMatch(/<button type="submit" class="btn primary submit-button"[^>]*>Guardar<\/button>/);
  });
});

describe('CA-26 · revocar', () => {
  test('⛔ el diálogo dice que no tiene vuelta directa: para devolver el acceso hay que borrarla e invitarla otra vez', () => {
    const html = render(createElement(PersonActionDialog, { action: 'revoke', email: 'beto@acme.com', companyName: 'Acme', rejection: null, onClose: () => {} }));
    expect(html).toContain('No tiene vuelta directa: para devolverle el acceso hay que borrarla e invitarla otra vez.');
    expect(html).toMatch(/<button type="submit" class="btn person-action-dialog__confirm submit-button"[^>]*>Revocar acceso<\/button>/);
  });
});

describe('lo que viaja al backend', () => {
  function apiAnswering(respond: () => Response) {
    const seen: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init.body)) });
      return respond();
    }) as unknown as typeof fetch;
    return { api: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), seen };
  }
  const base = `https://api.example/v1/admin/clientes/${COMPANY}/personas`;

  test('⛔ cada acción va a su ruta con el correo en el cuerpo, y solo con lo que cambió', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ accion: 'x', persona: {}, correoDeInvitacion: 'enviado' }));
    const pedidos: PersonActionRequest[] = [
      { action: 'change-role', email: 'beto@acme.com', change: { role: null }, reason: 'reorganización' },
      { action: 'change-role', email: 'beto@acme.com', change: { isAdmin: false }, reason: '' },
      { action: 'revoke', email: 'beto@acme.com', reason: '' },
      { action: 'resend-invitation', email: 'beto@acme.com' },
    ];
    for (const pedido of pedidos) await api.personAction('t', COMPANY, pedido);
    expect(seen).toEqual([
      { url: `${base}/cambiar-rol`, body: { correo: 'beto@acme.com', rol: null, motivo: 'reorganización' } },
      { url: `${base}/cambiar-rol`, body: { correo: 'beto@acme.com', admin: false } },
      { url: `${base}/revocar`, body: { correo: 'beto@acme.com' } },
      { url: `${base}/reenviar-invitacion`, body: { correo: 'beto@acme.com' } },
    ]);
  });

  test('reenviar dice si salió el correo, y el aviso lo cuenta', async () => {
    const { api } = apiAnswering(() => Response.json({ accion: 'reenviar-invitacion', correoDeInvitacion: 'no-enviado' }));
    const r = await api.personAction('t', COMPANY, { action: 'resend-invitation', email: 'beto@acme.com' });
    expect(r).toEqual({ kind: 'ok', value: { action: 'resend-invitation', appUnlinked: null, noticeEmail: 'not-sent' } });
    expect(personActionNotice(personActionNoticeParams({ action: 'resend-invitation', appUnlinked: null, noticeEmail: 'not-sent' }))).toContain('no salió');
    expect(personActionNotice(personActionNoticeParams({ action: 'revoke', appUnlinked: null, noticeEmail: null }))).toContain('borrarla e invitarla otra vez');
  });

  test('⛔ los rechazos nuevos llegan al diálogo traducidos, no como «la API no responde» (CA-29)', async () => {
    const casos: [number, object, object][] = [
      [409, { codigo: 'ya-revocado' }, { code: 'already-revoked' }],
      [409, { codigo: 'ya-entro' }, { code: 'already-joined' }],
      [409, { codigo: 'en-pausa' }, { code: 'seat-paused' }],
      [409, { codigo: 'correo-no-disponible' }, { code: 'email-unavailable' }],
      [429, { codigo: 'reenvio-limitado', reintentarEl: '2026-11-26T18:00:00.000Z' }, { code: 'resend-limited', retryAt: '2026-11-26T18:00:00.000Z' }],
      [409, { codigo: 'cuenta-personal' }, { code: 'personal-account' }],
      [422, { codigo: 'rol-inexistente', roles: ['ventas'] }, { code: 'unknown-role', roles: ['ventas'] }],
    ];
    for (const [status, body, rejection] of casos) {
      const { api } = apiAnswering(() => Response.json(body, { status }));
      expect(await api.personAction('t', COMPANY, { action: 'resend-invitation', email: 'beto@acme.com' })).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });

  test('el diálogo dice el rechazo según la acción: la única admin, el reenvío limitado y la cuenta personal', () => {
    const dialogo = (action: 'change-role' | 'resend-invitation', rejection: object) =>
      render(createElement(PersonActionDialog, { action, email: 'beto@acme.com', companyName: 'Acme', rejection: rejection as never, onClose: () => {} }));
    expect(dialogo('change-role', { code: 'last-admin' })).toContain('antes de quitarle el admin');
    expect(dialogo('resend-invitation', { code: 'resend-limited', retryAt: '2026-11-26T18:00:00.000Z' })).toContain('Se puede reenviar desde el 26 nov 2026, 13:00');
    expect(dialogo('change-role', { code: 'personal-account' })).toContain('su rol, su acceso y su invitación no se cambian');
  });
});
