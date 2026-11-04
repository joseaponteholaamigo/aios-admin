// La pantalla de «Nueva empresa» y «Nueva cuenta personal» (spec «Crear empresas e invitar
// personas», CA-6, CA-16 a CA-21 y CB-5).
//
// EL DEFECTO QUE PREVIENE. Si la clave cambiara entre un intento y su reintento, el backend crearía
// dos cuentas. Si el aviso de «creada» llevara el correo en la dirección, quedaría en los logs de
// acceso. Y si el botón de mover fuera el primero del formulario, Enter en cualquier campo borraría
// una cuenta personal sin que nadie lo oprimiera.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { WriteRejection } from '../app/domain/account-creation';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const createAccount = vi.fn();
const { AdminApiUnavailableError } = await import('../app/shared/api/admin-api.server');
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ createAccount }) }));
const { loader, action } = await import('../app/modules/companies/routes/company-new');
const { NewAccountForm } = await import('../app/modules/companies/components/new-account-form');

const KEY = 'clave-de-prueba-0001';
const member = (isSuperadmin: boolean): TeamMember => ({ actor: 'equipo:sub', email: null, name: null, isSuperadmin, status: 'active', permissions: { companies: 'edit' } });

function contextFor(m: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  context.set(teamMemberContext, m);
  return context;
}

const formFields = { kind: 'company', name: 'Acme', plan: 'free', adminEmail: 'ana@acme.com', key: KEY, intent: 'submit' };
function post(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return action({ request: new Request('https://dxxxx.cloudfront.net/companies/new', { method: 'POST', body }), context: contextFor(member(true)), params: {} } as never);
}

const COMPANY = { id: 'acme-1a2b3c', name: 'Acme' };

beforeEach(() => {
  createAccount.mockReset();
});

describe('la ruta', () => {
  test('CA-21 · cada formulario nace con su propia clave; mover se ofrece solo al superadministrador', async () => {
    const abrir = (m: TeamMember, url = 'https://dxxxx.cloudfront.net/companies/new') => loader({ request: new Request(url), context: contextFor(m), params: {} } as never);
    const [uno, dos] = [await abrir(member(true)), await abrir(member(false), 'https://dxxxx.cloudfront.net/companies/new?kind=personal')];
    expect(uno.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(uno.key).not.toBe(dos.key);
    expect([uno.canMove, dos.canMove, uno.kind, dos.kind]).toEqual([true, false, 'company', 'personal']);
  });

  test('⛔ CB-5 · al crear lleva a la ficha nueva con el aviso, sin el correo en la dirección', async () => {
    createAccount.mockResolvedValue({ kind: 'ok', value: { company: COMPANY, invitationSent: true, movedFrom: null } });
    const r = (await post(formFields)) as Response;
    expect(createAccount).toHaveBeenCalledWith('token-ana', expect.objectContaining({ name: 'Acme', plan: 'free', adminEmail: 'ana@acme.com', key: KEY, moveFromPersonal: false }));
    expect(r.headers.get('Location')).toBe('/companies/acme-1a2b3c?aviso=creada');
  });

  test('⛔ CA-6 · un rechazo vuelve con lo escrito y la MISMA clave, para que el reintento cree una sola cuenta', async () => {
    const rejection: WriteRejection = { code: 'email-in-other-company', company: { id: 'otra-1', name: 'Otra' } };
    createAccount.mockResolvedValue({ kind: 'rejected', rejection });
    const r = (await post(formFields)) as { values: Record<string, string>; rejection: WriteRejection };
    expect([r.values.key, r.values.name, r.rejection]).toEqual([KEY, 'Acme', rejection]);
  });

  test('⛔ si la API no responde, vuelve al formulario con la MISMA clave, no a la página de error', async () => {
    createAccount.mockRejectedValue(new AdminApiUnavailableError('no respondió'));
    const r = (await post(formFields)) as { values: Record<string, string>; rejection: WriteRejection };
    expect([r.values.key, r.rejection]).toEqual([KEY, { code: 'unavailable' }]);
  });

  test('un formulario mal llenado no llega al backend', async () => {
    const r = (await post({ ...formFields, adminEmail: 'ana' })) as { errors: Record<string, string> };
    expect(createAccount).not.toHaveBeenCalled();
    expect(Object.keys(r.errors)).toEqual(['adminEmail']);
  });
});

/** Renderiza dentro de un router: el formulario usa la navegación y lleva enlaces. */
function render<P extends object>(Component: ComponentType<P>, props: P) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/companies/new'] }));
}

const formWith = (rejection: WriteRejection, canMove = true) =>
  render(NewAccountForm, { kind: 'company', formKey: KEY, canMove, values: formFields, errors: {}, rejection, createdAccountId: null });
const ACCOUNT = { id: 'webinar-c1-0000a1', name: 'Webinar', paysWithStripe: false };

describe('el formulario', () => {
  test('⛔ con una cuenta personal en el camino, el primer botón del formulario es el de crear, no el de mover', () => {
    const html = formWith({ code: 'email-in-personal-account', account: ACCOUNT });
    const botones = [...html.matchAll(/<button[^>]*type="submit"[^>]*>/g)].map((m) => m[0]);
    expect(botones).toHaveLength(2);
    expect(botones[0]).toContain('name="intent"');
    expect(botones[1]).toContain('name="move"');
  });

  test('CA-20 · sin ser superadministrador, o con una cuenta que paga por Stripe, no hay botón de mover', () => {
    expect(formWith({ code: 'email-in-personal-account', account: ACCOUNT }, false)).not.toContain('name="move"');
    expect(formWith({ code: 'email-in-personal-account', account: { ...ACCOUNT, paysWithStripe: true } })).not.toContain('name="move"');
  });

  test('CA-19 · el correo de otra empresa se dice junto al campo, con su nombre', () => {
    expect(formWith({ code: 'email-in-other-company', company: { id: 'otra-1', name: 'Otra SAS' } })).toContain('Ese correo ya está en Otra SAS (otra-1).');
  });

  test('CA-23 · el formulario no tiene dónde mostrar una license key', () => {
    expect(render(NewAccountForm, { kind: 'company', formKey: KEY, canMove: false, values: null, errors: {}, rejection: null, createdAccountId: null }).toLowerCase()).not.toMatch(/license|llave|aios_/);
  });

  test('una cuenta que ya quedó creada se nombra, con su enlace, para que nadie cree otra', () => {
    const html = render(NewAccountForm, { kind: 'company', formKey: KEY, canMove: true, values: formFields, errors: {}, rejection: { code: 'move-incomplete' }, createdAccountId: 'acme-1a2b3c' });
    expect(html).toContain('href="/companies/acme-1a2b3c"');
  });
});
