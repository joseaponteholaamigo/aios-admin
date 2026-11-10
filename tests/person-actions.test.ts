// Las acciones sobre una persona en el panel (spec «Borrar cuentas y destrabar personas», CA-8 a
// CA-12): quién las ve, qué pide cada una, qué dice el diálogo y qué aviso queda al terminar.
//
// EL DEFECTO QUE PREVIENE. Si alguien que no es superadministrador viera o pudiera mandar una acción,
// el panel dejaría de negar antes que el backend. Si el correo viajara en la dirección, quedaría en los
// logs de CloudFront. Si el diálogo no dijera qué le pasa a la persona, se borraría a alguien por error.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import type { PersonActionDone } from '../app/domain/person-actions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { personActionNotice, personActionNoticeParams } from '../app/modules/client-users/person-action-labels';

const personAction = vi.fn();
const getCompanyPeople = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ personAction }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ getCompanyPeople }) }));
const { action, loader } = await import('../app/modules/client-users/routes/company-people');
const { PeoplePanel } = await import('../app/modules/client-users/components/people-panel');
const { PersonActionDialog } = await import('../app/modules/client-users/components/person-action-dialog');

const superadmin: TeamMember = { actor: 'equipo:sub-jose', email: null, name: null, isSuperadmin: true, status: 'active', permissions: {} };
const conTodo: TeamMember = { ...superadmin, isSuperadmin: false, permissions: { clientUsers: 'edit', companies: 'edit' } };
const COMPANY = 'acme-1a2b3c';

function contexto(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-jose', tokens: { accessToken: 'token-jose' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

function post(fields: Record<string, string>, member: TeamMember = superadmin) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const request = new Request(`https://dxxxx.cloudfront.net/client-users/${COMPANY}`, { method: 'POST', body });
  return action({ request, context: contexto(member), params: { companyId: COMPANY } } as never);
}

const render = (element: ReturnType<typeof createElement>) => {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/client-users/${COMPANY}`] }));
};

const PERSONA = { email: 'beto@acme.com', isAdmin: false, role: null, status: 'active', sees: { kind: 'all' }, counts: { skills: 0, agents: 0, chains: 0 }, invitedAt: null, acceptedAt: null };

beforeEach(() => { personAction.mockReset(); getCompanyPeople.mockReset(); });

describe('la acción de la página de personas', () => {
  test('⛔ quien no es superadministrador recibe 403 aunque tenga todos los módulos, y no se llama a la API (CA-9)', async () => {
    await expect(post({ intent: 'delete-person', email: 'beto@acme.com' }, conTodo)).rejects.toMatchObject({ init: { status: 403 } });
    expect(personAction).not.toHaveBeenCalled();
  });

  test('⛔ pide a la cuenta de la dirección, con el correo en el cuerpo, y vuelve con el aviso sin el correo (CA-8, CA-11)', async () => {
    personAction.mockResolvedValue({ kind: 'ok', value: { action: 'reset-mfa', appUnlinked: true, noticeEmail: 'sent' } });

    const r = (await post({ intent: 'reset-mfa', email: 'beto@acme.com' })) as Response;

    expect(personAction).toHaveBeenCalledWith('token-jose', COMPANY, { action: 'reset-mfa', email: 'beto@acme.com' });
    expect(r.headers.get('Location')).toBe(`/client-users/${COMPANY}?persona=mfa-restablecido`);
  });

  test('un rechazo vuelve con el intento, para reabrir el diálogo de esa acción y esa persona (CA-12)', async () => {
    personAction.mockResolvedValue({ kind: 'rejected', rejection: { code: 'last-admin' }, createdAccountId: null });

    const r = await post({ intent: 'delete-person', email: 'ana@acme.com' });

    expect(r).toEqual({ attempt: { action: 'delete-person', email: 'ana@acme.com' }, rejection: { code: 'last-admin' } });
  });

  test('un formulario sin una acción conocida no llama a la API', async () => {
    const r = await post({ intent: 'suspend', email: 'beto@acme.com' });

    expect(r).toMatchObject({ attempt: null, rejection: { code: 'invalid' } });
    expect(personAction).not.toHaveBeenCalled();
  });

  test('⛔ el loader da las acciones solo al superadministrador, no a quien tiene todos los módulos (CA-9)', async () => {
    getCompanyPeople.mockResolvedValue({ kind: 'ok', value: { company: { id: COMPANY, name: 'Acme' } } });
    const pedir = (member: TeamMember) => loader({ request: new Request(`https://dxxxx.cloudfront.net/client-users/${COMPANY}`), context: contexto(member), params: { companyId: COMPANY } } as never);

    expect([(await pedir(superadmin)).canActOnPeople, (await pedir(conTodo)).canActOnPeople]).toEqual([true, false]);
  });
});

describe('lo que se ve', () => {
  test('⛔ el menú de acciones aparece solo para el superadministrador (CA-9)', () => {
    const panel = (canAct: boolean) => render(createElement(PeoplePanel, { people: [PERSONA] as never, roles: [], companyName: 'Acme', canAct, lastAttempt: null }));

    expect(panel(true)).toContain('Restablecer verificación en dos pasos');
    expect(panel(false)).not.toContain('Acciones');
  });

  test('⛔ el diálogo dice a quién y qué le pasa, y manda la acción y el correo en el cuerpo (CA-10)', () => {
    const html = render(createElement(PersonActionDialog, { action: 'delete-person', email: 'beto@acme.com', companyName: 'Acme', rejection: null, onClose: () => {} }));

    expect(html).toContain('beto@acme.com sale de Acme');
    expect(html).toContain('No se puede deshacer');
    expect(html).toMatch(/<input type="hidden" name="intent" value="delete-person"\/>/);
    expect(html).toMatch(/<input type="hidden" name="email" value="beto@acme.com"\/>/);
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).not.toMatch(/<form[^>]*action="[^"]*@/);
  });

  test('el diálogo dice el rechazo en palabras simples, y el login de otra cuenta con su sentido de aquí (CA-12)', () => {
    const dialogo = (rejection: object) => render(createElement(PersonActionDialog, { action: 'delete-login', email: 'beto@acme.com', companyName: 'Acme', rejection: rejection as never, onClose: () => {} }));

    expect(dialogo({ code: 'last-admin' })).toContain('Es la única admin de la cuenta');
    expect(dialogo({ code: 'no-login', seat: 'active' })).toContain('ya se borró');
    expect(dialogo({ code: 'no-login', seat: 'invited' })).toContain('todavía no se registró');
    expect(dialogo({ code: 'not-found' })).toContain('ya no tiene asiento en esta cuenta');
    expect(dialogo({ code: 'recent-mfa' })).toContain('Para hacer esta acción tienes que volver a ingresar tu código');
    expect(dialogo({ code: 'recent-mfa' })).toContain('Ingresar el código');
    expect(dialogo({ code: 'email-in-other-company', company: null })).toContain('es de otra cuenta: desde aquí no se toca');
  });
});

describe('el aviso al terminar (CA-11)', () => {
  const aviso = (done: PersonActionDone) => personActionNotice(personActionNoticeParams(done));

  test('dice qué pasó, y si el correo de aviso no salió, que hay que avisarle por otro medio', () => {
    expect(aviso({ action: 'reset-mfa', appUnlinked: true, noticeEmail: 'sent' })).toMatch(/^Se restableció.*Le llegó un correo/);
    expect(aviso({ action: 'delete-login', appUnlinked: null, noticeEmail: 'not-sent' })).toContain('avísale por otro medio');
    expect(aviso({ action: 'reset-mfa', appUnlinked: false, noticeEmail: null })).toContain('No tenía app de códigos');
    expect(aviso({ action: 'delete-person', appUnlinked: null, noticeEmail: null })).toBe('Se borró a la persona de la cuenta.');
  });

  test('una dirección sin el código de una acción no muestra aviso', () => {
    expect(personActionNotice(new URLSearchParams({ persona: 'otra-cosa' }))).toBeNull();
  });
});
