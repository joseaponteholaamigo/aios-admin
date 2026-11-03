// Cómo se ve una cuenta personal: en su tabla, en su ficha y en Usuarios de clientes (spec «Cuentas
// personales», CA-21 a CA-23).
//
// EL DEFECTO QUE PREVIENE. Una cuenta personal se dio de alta con un nombre inventado («Webinar
// 20261028 C123»). Si el panel la nombrara así, el equipo no sabría de quién es; si su ficha mostrara
// asientos y admins, parecería una empresa a medio armar; y si «Ver sus personas» siguiera ahí,
// llevaría a una pantalla de equipo para una sola persona.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, test } from 'vitest';
import type { ClientUser } from '../app/domain/client-users';
import type { Company, CompanyFile } from '../app/domain/companies';
import Company_ from '../app/modules/companies/routes/company';
import { PersonalAccountsTable } from '../app/modules/companies/components/personal-accounts-table';
import { ClientUsersTable } from '../app/modules/client-users/components/client-users-table';

const MARIA = { email: 'maria@gmail.com', status: 'active', invitedAt: '2026-10-28T10:00:00Z', acceptedAt: '2026-10-29T10:00:00Z' } as const;

const cuenta = (extra: Partial<Company> = {}): Company => ({
  id: 'webinar-c1-0000a1', name: 'Webinar 20261028 C1', kind: 'personal', person: MARIA, plan: 'custom', status: 'active',
  expiry: { expired: false, expiredBy: null, until: null }, notice: null, seats: { used: 1, cap: 1 }, admins: 1,
  paysWithStripe: false, createdAt: '2026-10-28T10:00:00Z', ...extra,
});

const ficha = (extra: Partial<CompanyFile> = {}): CompanyFile => ({
  ...cuenta(),
  effectivePlan: { tier: 'pro', preset: 'pro', flags: { collaboration: false, scheduling: true }, quotas: {}, seats: 1, managesSeats: false },
  conditions: null, access: null, accessPending: 'falta publicar', ...extra,
});

/** Renderiza dentro de un router, porque las tablas y la ficha llevan enlaces. */
function render<P extends object>(Component: ComponentType<P>, props: P) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/'] }));
}

const fileOf = (file: CompanyFile, canSeePeople = true) => render(Company_ as ComponentType<object>, { loaderData: { file, history: [], canSeePeople } });

describe('la tabla de cuentas personales', () => {
  test('CA-21 · cada fila dice el correo de su persona, su plan, de dónde salió y cuándo entró, no el nombre inventado', () => {
    const html = render(PersonalAccountsTable, { accounts: [cuenta(), cuenta({ id: 'pedro-000002', paysWithStripe: true, person: { ...MARIA, email: 'pedro@nube.co', acceptedAt: null } })], emptyMessage: '' });
    expect([...html.matchAll(/<th>([^<]+)<\/th>/g)].map((m) => m[1])).toEqual(['Persona', 'Plan', 'Estado', 'Vence', 'Origen', 'Entró']);
    expect(html).toContain('maria@gmail.com');
    expect(html).not.toContain('Webinar 20261028');
    expect(html).toContain('Alta del equipo');
    expect(html).toContain('Compra en la web');
    expect(html).toContain('Todavía no');
  });

  test('una cuenta sin persona dice «Sin persona»', () => {
    expect(render(PersonalAccountsTable, { accounts: [cuenta({ person: null })], emptyMessage: '' })).toContain('Sin persona');
  });
});

describe('la ficha de una cuenta personal', () => {
  test('CA-22 · se nombra por su persona, dice que es una cuenta personal y su camino pasa por la pestaña', () => {
    const html = fileOf(ficha());
    expect(html).toMatch(/<h1[^>]*>maria@gmail\.com<\/h1>/);
    expect(html).toContain('Cuenta personal');
    expect(html).toContain('href="/companies?kind=personal"');
    expect(html).not.toContain('Webinar 20261028');
  });

  test('CA-22 · muestra a su persona en vez de la parte de equipo, sin «Ver sus personas»', () => {
    const html = fileOf(ficha());
    expect(html).toMatch(/<h2>Persona<\/h2>/);
    expect(html).not.toMatch(/<dt>(Asientos|Maneja equipo)<\/dt>/);
    expect(html).not.toContain('Ver sus personas');
  });

  test('sin persona, la ficha se nombra por su id y lo dice', () => {
    const html = fileOf(ficha({ person: null }));
    expect(html).toMatch(/<h1[^>]*>webinar-c1-0000a1<\/h1>/);
    expect(html).toContain('nadie puede entrar a ENSŌ con ella');
  });

  test('la ficha de una empresa no cambia: su nombre, sus asientos y «Ver sus personas»', () => {
    const html = fileOf(ficha({ kind: 'company', person: null, name: 'Auteco' }));
    expect(html).toMatch(/<h1[^>]*>Auteco<\/h1>/);
    expect(html).toMatch(/<dt>Asientos<\/dt>/);
    expect(html).toContain('Ver sus personas');
    expect(html).not.toMatch(/<h2>Persona<\/h2>/);
  });
});

describe('Usuarios de clientes', () => {
  const persona = (kind: 'company' | 'personal'): ClientUser => ({
    email: 'maria@gmail.com', role: null, isAdmin: true, status: 'active', invitedAt: null, acceptedAt: null,
    company: { id: 'webinar-c1-0000a1', name: kind === 'personal' ? 'Webinar 20261028 C1' : 'Auteco', kind },
  });

  test('CA-23 · una persona de una cuenta personal dice «Cuenta personal», con enlace a sus personas, y no el nombre inventado', () => {
    const html = render(ClientUsersTable, { people: [persona('personal')], emptyMessage: '' });
    expect(html).toMatch(/<a[^>]*href="\/client-users\/webinar-c1-0000a1"[^>]*>Cuenta personal<\/a>/);
    expect(html).not.toContain('Webinar 20261028');
  });

  test('una persona de una empresa muestra el nombre de la empresa en una sola línea, con el id al pasar el mouse', () => {
    const html = render(ClientUsersTable, { people: [persona('company')], emptyMessage: '' });
    expect(html).toContain('class="ent ent--sm"');
    expect(html).toContain('title="webinar-c1-0000a1"');
    expect(html).toContain('<b>Auteco</b>');
    expect(html).not.toContain('<small>webinar-c1-0000a1</small>');
  });
});
