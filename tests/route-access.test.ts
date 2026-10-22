// Qué exige cada pedido y qué ve cada persona en el menú (`app/shared/routing/route-access.ts`).
//
// EL DEFECTO QUE PREVIENE. Si el pedido de datos de una página (`/x.data`) no se reconociera como
// esa página, el permiso se revisaría contra otra ruta. Si cualquier dirección bajo `/auth/` se
// tomara por pública, bastaría inventar una para saltarse el login. Y si el menú mostrara un
// módulo que la persona no puede usar, la llevaría a un «sin acceso».
import { describe, expect, test } from 'vitest';
import { accessFor, allows, menuFor } from '../app/shared/routing/route-access';
import type { RouteEntry } from '../app/shared/routing/route-table';
import { teamMember } from './helpers/fake-admin-api';

const url = (path: string) => new URL(`https://dxxxx.cloudfront.net${path}`);

describe('accessFor', () => {
  test('un pedido de datos exige lo mismo que su página', () => {
    expect(accessFor(url('/'))).toBe('member');
    expect(accessFor(url('/_.data'))).toBe('member');
    expect(accessFor(url('/auth/login.data'))).toBe('public');
  });

  test('⛔ una ruta que no está en la tabla no exige nada conocido: se niega', () => {
    expect(accessFor(url('/empresas'))).toBeNull();
    expect(accessFor(url('/auth/inventada'))).toBeNull();
  });
});

describe('allows y menuFor', () => {
  const TABLE: RouteEntry[] = [
    { path: '', file: 'x', access: 'member', menuLabel: 'Inicio' },
    { path: 'companies', file: 'x', access: { module: 'companies', level: 'view' }, menuLabel: 'Empresas' },
    { path: 'usage', file: 'x', access: { module: 'usage', level: 'view' }, menuLabel: 'Consumo' },
    { path: 'companies/:id/edit', file: 'x', access: { module: 'companies', level: 'edit' } },
  ];

  test('⛔ el menú no muestra los módulos que la persona no puede usar', () => {
    const member = teamMember('ana', { permissions: { companies: 'view' } });
    expect(menuFor(member, TABLE)).toEqual([
      { path: '/', label: 'Inicio' },
      { path: '/companies', label: 'Empresas' },
    ]);
  });

  test('⛔ una persona inactiva no cumple ni «miembro»', () => {
    expect(allows(teamMember('ana', { status: 'inactive' }), 'member')).toBe(false);
  });
});
