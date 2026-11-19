// El marco del panel viejo: barra lateral con el menú agrupado y barra superior (CA-23).
//
// EL DEFECTO QUE PREVIENE. El menú es lo que dice qué puede abrir cada persona: si el marco
// mostrara un módulo que `menuFor` dejó fuera, o lo pusiera en el grupo equivocado, la persona
// buscaría lo que no tiene donde no está. Y si el marco trajera piezas del panel viejo sin datos
// detrás («Nueva empresa», el buscador), prometería funciones que M2a no tiene.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, test } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { AppShell } from '../app/shared/layout/app-shell';
import { menuFor } from '../app/shared/routing/route-access';
import type { RouteEntry } from '../app/shared/routing/route-table';
import { teamMember } from './helpers/fake-admin-api';

const TABLE: RouteEntry[] = [
  { path: '', file: 'x', access: 'member', menu: { label: 'Inicio', group: 'administration', icon: 'fleet' } },
  { path: 'companies', file: 'x', access: { module: 'companies', level: 'view' }, menu: { label: 'Empresas', group: 'administration', icon: 'empresas' } },
  { path: 'governance', file: 'x', access: { module: 'governance', level: 'view' }, menu: { label: 'Gobernanza', group: 'business', icon: 'gobernanza' } },
];

/** El marco de `member`, renderizado en `at`, con su menú armado como en la raíz. */
function shellFor(member: TeamMember, at = '/') {
  const shell = () =>
    createElement(AppShell, {
      member: { name: member.name ?? member.actor, isSuperadmin: member.isSuperadmin },
      menu: menuFor(member, TABLE),
      children: createElement('p', null, 'contenido de la página'),
    });
  const Stub = createRoutesStub([{ path: '*', Component: shell }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

/** Los enlaces del menú, en orden, con el grupo al que pertenecen. */
function menuOf(html: string) {
  return [...html.matchAll(/<nav[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/nav>/g)].map(([, group, body]) => ({
    group,
    links: [...(body ?? '').matchAll(/<a[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/g)].map((m) => m[1]),
  }));
}

describe('el marco del panel', () => {
  test('⛔ el menú muestra solo lo que la persona puede usar, agrupado como en el panel viejo', () => {
    const html = shellFor(teamMember('ana', { name: 'Ana', permissions: { companies: 'view' } }));
    expect(menuOf(html)).toEqual([{ group: 'Administración', links: ['Inicio', 'Empresas'] }]);
  });

  test('cada grupo va en su orden, con su nombre, y cada entrada con su ícono', () => {
    const html = shellFor(teamMember('jose', { name: 'Jose', isSuperadmin: true }));
    expect(menuOf(html)).toEqual([
      { group: 'Administración', links: ['Inicio', 'Empresas'] },
      { group: 'Negocio', links: ['Gobernanza'] },
    ]);
    const links = [...html.matchAll(/<nav[\s\S]*?<\/nav>/g)].flatMap((m) => [...m[0].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)]);
    expect(links).toHaveLength(3);
    expect(links.filter((m) => !(m[1] ?? '').startsWith('<svg'))).toEqual([]);
  });

  test('marca la página actual: el inicio solo en «/», un módulo también en sus páginas internas', () => {
    const current = (html: string) => [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/g)].map((m) => m[1]);
    const jose = teamMember('jose', { isSuperadmin: true });
    expect(current(shellFor(jose, '/'))).toEqual(['Inicio']);
    expect(current(shellFor(jose, '/companies/acme-123456'))).toEqual(['Empresas']);
  });

  test('la barra superior dice quién entró y con qué papel, y deja salir por POST', () => {
    const ana = shellFor(teamMember('ana', { name: 'Ana' }));
    expect(ana).toContain('Ana<small>Equipo ensō</small>');
    expect(ana).toMatch(/<span class="adm-avatar"[^>]*>A<\/span>/);
    // El orden de los atributos lo decide React: se miran por separado.
    const form = ana.match(/<form\b[^>]*>/)?.[0] ?? '';
    expect(form).toContain('method="post"');
    expect(form).toContain('action="/auth/logout"');
    expect(shellFor(teamMember('jose', { name: 'Jose', isSuperadmin: true }))).toContain('Jose<small>Superadministrador</small>');
  });

  test('pinta la página dentro del marco', () => {
    expect(shellFor(teamMember('ana'))).toMatch(/<main class="adm-page"><p>contenido de la página<\/p><\/main>/);
  });

  test('⛔ no trae piezas del panel viejo que M2a no tiene: ni «Nueva empresa» ni el buscador', () => {
    const html = shellFor(teamMember('jose', { isSuperadmin: true }));
    // Que el marco se pintó de verdad: una página de error también pasaría las negativas.
    expect(html).toContain('class="adm-side');
    expect(html).not.toContain('Nueva empresa');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('adm-sidefoot');
  });
});
