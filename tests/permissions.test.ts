// La regla de permisos del equipo (`app/domain/permissions.ts`).
//
// EL DEFECTO QUE PREVIENE. Si `ver` diera `editar`, quien solo debe mirar Empresas podría
// cambiarlas desde el panel; si una persona suspendida o un nivel inventado pasaran, la puerta se
// abriría por un dato mal escrito. El backend vuelve a revisar, pero el panel no debe ofrecer lo
// que después se rechaza.
import { describe, expect, test } from 'vitest';
import { can, grantedModules } from '../app/domain/permissions';
import { teamMember } from './helpers/fake-admin-api';

describe('can', () => {
  test('editar incluye ver, y ver no da editar', () => {
    const editor = teamMember('ana', { permissions: { companies: 'edit' } });
    const viewer = teamMember('beto', { permissions: { companies: 'view' } });
    expect([can(editor, 'companies', 'view'), can(editor, 'companies', 'edit')]).toEqual([true, true]);
    expect([can(viewer, 'companies', 'view'), can(viewer, 'companies', 'edit')]).toEqual([true, false]);
  });

  test('⛔ un módulo sin asignar no se puede usar', () => {
    expect(can(teamMember('ana', { permissions: { companies: 'edit' } }), 'usage', 'view')).toBe(false);
  });

  test('el superadministrador puede todo, menos un nivel que el módulo no admite', () => {
    const superadmin = teamMember('jose', { isSuperadmin: true });
    expect(can(superadmin, 'usage', 'edit')).toBe(true);
    expect(can(superadmin, 'documentText', 'edit')).toBe(false);
  });

  test('⛔ una persona inactiva no puede nada, aunque sea superadministradora', () => {
    expect(can(teamMember('ana', { status: 'inactive', isSuperadmin: true }), 'companies', 'view')).toBe(false);
  });
});

describe('grantedModules', () => {
  test('lista lo asignado en el orden del panel', () => {
    const member = teamMember('ana', { permissions: { usage: 'view', companies: 'edit' } });
    expect(grantedModules(member)).toEqual([
      { module: 'companies', level: 'edit' },
      { module: 'usage', level: 'view' },
    ]);
  });

  test('el superadministrador tiene todos, cada uno en su nivel más alto', () => {
    const modules = grantedModules(teamMember('jose', { isSuperadmin: true }));
    expect(modules).toHaveLength(10);
    expect(modules).toContainEqual({ module: 'companies', level: 'edit' });
    expect(modules).toContainEqual({ module: 'documentText', level: 'view' });
  });

  test('una persona inactiva no tiene ninguno', () => {
    expect(grantedModules(teamMember('ana', { status: 'inactive', permissions: { companies: 'edit' } }))).toEqual([]);
  });
});
