// La página de inicio (CA-31): quién es la persona y qué módulos puede usar, como los da `/yo`.
//
// EL DEFECTO QUE PREVIENE. Es lo primero que ve el equipo para saber con qué permisos entró. Si
// mostrara un módulo que la persona no tiene, o callara uno que sí, la persona creería tener un
// acceso que no tiene (o pediría uno que ya tiene).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { teamMemberContext } from '../app/middleware/permissions.server';
import { loader } from '../app/modules/home/routes/home';
import { MemberSummary } from '../app/modules/home/components/member-summary';
import type { TeamMember } from '../app/domain/permissions';
import { teamMember } from './helpers/fake-admin-api';

function pageFor(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(teamMemberContext, member);
  const data = loader({ context } as never);
  return { data, html: renderToStaticMarkup(createElement(MemberSummary, data)) };
}

describe('página de inicio', () => {
  test('muestra el nombre y cada módulo con su nivel, y nada más', () => {
    const { html } = pageFor(teamMember('ana', { name: 'Ana', permissions: { companies: 'edit', usage: 'view' } }));
    expect(html).toContain('Ana');
    expect(html).toContain('Empresas: Editar');
    expect(html).toContain('Consumo: Ver');
    expect(html).not.toContain('Documentos');
    expect(html).not.toContain('Superadministrador');
  });

  test('el superadministrador se ve como tal, con todos los módulos', () => {
    const { data, html } = pageFor(teamMember('jose', { name: 'Jose', isSuperadmin: true }));
    expect(html).toContain('Superadministrador');
    expect(data.modules).toHaveLength(10);
  });

  test('sin nombre, se muestra el correo; sin módulos, se dice', () => {
    const { html } = pageFor(teamMember('beto', { name: null }));
    expect(html).toContain('beto@beenso.com');
    expect(html).toContain('Todavía no tienes módulos asignados');
  });
});
