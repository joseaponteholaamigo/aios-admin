// La pantalla de «Invitar persona» (spec «Crear empresas e invitar personas», CA-22 y CB-5).
//
// EL DEFECTO QUE PREVIENE. Si la invitación fuera a otra cuenta que la de la dirección, la persona
// entraría a la empresa equivocada. Si el aviso llevara el correo en la dirección, quedaría en los
// logs de acceso. Y si «admin» se leyera encendido sin marcarlo, la persona gobernaría todo el equipo.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { readNewPerson } from '../app/modules/client-users/invite-person-form-data';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';

const invitePerson = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ invitePerson }) }));
const { action } = await import('../app/modules/client-users/routes/invite-person');
const { InvitePersonForm } = await import('../app/modules/client-users/components/invite-person-form');

const member: TeamMember = { actor: 'equipo:sub', email: null, name: null, isSuperadmin: false, status: 'active', permissions: { clientUsers: 'edit' } };

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function post(fields: Record<string, string>) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  const request = new Request('https://dxxxx.cloudfront.net/client-users/acme-1a2b3c/invite', { method: 'POST', body: formOf(fields) });
  return action({ request, context, params: { companyId: 'acme-1a2b3c' } } as never);
}

beforeEach(() => invitePerson.mockReset());

describe('invitar', () => {
  test('el formulario: admin solo si se marcó, sin rol es ninguno, y mover solo con su botón', () => {
    expect(readNewPerson(formOf({ email: ' Beto@Acme.com ', role: '', reason: 'lo pidió' }))).toEqual({
      person: { email: 'beto@acme.com', isAdmin: false, role: null, reason: 'lo pidió', moveFromPersonal: false },
    });
    const r = readNewPerson(formOf({ email: 'beto@acme.com', role: 'ventas', reason: 'x', isAdmin: 'on', move: '1' }));
    expect('person' in r && [r.person.isAdmin, r.person.role, r.person.moveFromPersonal]).toEqual([true, 'ventas', true]);
    const mal = readNewPerson(formOf({ email: 'beto', reason: '' }));
    expect('errors' in mal ? Object.keys(mal.errors).sort() : []).toEqual(['email', 'reason']);
  });

  test('⛔ invita a la cuenta de la dirección y vuelve a sus personas con el aviso, sin el correo', async () => {
    invitePerson.mockResolvedValue({ kind: 'ok', value: { invitationSent: false, movedFrom: 'webinar-c1-0000a1' } });
    const r = (await post({ email: 'beto@acme.com', role: '', reason: 'lo pidió' })) as Response;
    expect(invitePerson).toHaveBeenCalledWith('token-ana', 'acme-1a2b3c', expect.objectContaining({ email: 'beto@acme.com' }));
    expect(r.headers.get('Location')).toBe('/client-users/acme-1a2b3c?aviso=invitada-sin-correo&movida=1');
  });

  test('un rechazo vuelve al formulario con lo escrito', async () => {
    invitePerson.mockResolvedValue({ kind: 'rejected', rejection: { code: 'no-seats', used: 3, cap: 3 } });
    const r = (await post({ email: 'beto@acme.com', role: '', reason: 'lo pidió' })) as { values: Record<string, string>; rejection: unknown };
    expect([r.values.email, r.rejection]).toEqual(['beto@acme.com', { code: 'no-seats', used: 3, cap: 3 }]);
  });
});

test('⛔ con una cuenta personal en el camino, el primer botón del formulario es el de invitar, no el de mover', () => {
  const props = {
    company: { id: 'acme-1a2b3c', name: 'Acme' }, roles: [], canMove: true, values: { email: 'beto@acme.com' }, errors: {},
    rejection: { code: 'email-in-personal-account' as const, account: { id: 'webinar-c1-0000a1', name: 'W', paysWithStripe: false } },
  };
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(InvitePersonForm, props) }]);
  const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ['/client-users/acme-1a2b3c/invite'] }));
  const botones = [...html.matchAll(/<button[^>]*type="submit"[^>]*>/g)].map((m) => m[0]);
  expect(botones).toHaveLength(2);
  expect([botones[0]?.includes('name="intent"'), botones[1]?.includes('name="move"')]).toEqual([true, true]);
});
