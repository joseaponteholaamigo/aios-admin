// El acceso que exige cada pantalla de M2a, como lo dice la tabla de CA-28 de la spec.
//
// EL DEFECTO QUE PREVIENE. La prueba de la tabla de rutas solo exige que cada ruta declare ALGÚN
// acceso. Si Equipo ensō pasara a `member`, o las personas de un cliente a `companies`, todo seguiría
// en verde y alguien vería lo que no le toca. Esta fija cuál.
import { describe, expect, test } from 'vitest';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';

const EXPECTED = {
  companies: { module: 'companies', level: 'view' },
  'companies/:companyId': { module: 'companies', level: 'view' },
  'client-users': { module: 'clientUsers', level: 'view' },
  'client-users/checkup': { module: 'clientUsers', level: 'view' },
  'client-users/:companyId': { module: 'clientUsers', level: 'view' },
  governance: { module: 'governance', level: 'view' },
  team: 'superadmin',
} as const;

describe('las pantallas de M2a', () => {
  test.each(Object.entries(EXPECTED))('%s exige lo que dice la spec', (path, access) => {
    expect(ROUTE_TABLE.find((r) => r.path === path)?.access).toEqual(access);
  });

  test('⛔ la revisión de datos va antes que `:companyId`: si no, `checkup` se leería como una empresa', () => {
    const paths = ROUTE_TABLE.map((r) => r.path);
    expect(paths.indexOf('client-users/checkup')).toBeLessThan(paths.indexOf('client-users/:companyId'));
  });
});
