// Toda ruta declara su acceso, y solo el login y «sin acceso» son públicos (CA-25).
//
// EL DEFECTO QUE PREVIENE. Una pantalla nueva que se agrega sin declarar qué permiso pide quedaría
// abierta a cualquiera del equipo; una que se marca pública por error, a cualquiera de internet.
// Esta prueba falla el día que pasa, nombrando la ruta.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import routes from '../app/routes';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';
import { MODULE_LEVELS } from '../app/domain/permissions';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');

/** Los archivos de ruta de cada módulo (`app/modules/<módulo>/routes/*.tsx`), relativos a `app/`. */
function routeFiles(): string[] {
  const modulesDir = join(appDir, 'modules');
  return readdirSync(modulesDir).flatMap((module) => {
    const dir = join(modulesDir, module, 'routes');
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => `modules/${module}/routes/${f}`);
  });
}

describe('la tabla de rutas', () => {
  test('⛔ cada archivo de ruta está en la tabla, con su acceso declarado', () => {
    const files = routeFiles();
    expect(files.length).toBeGreaterThan(0);
    const declared = new Set(ROUTE_TABLE.map((r) => r.file));
    expect(files.filter((f) => !declared.has(f))).toEqual([]);
  });

  test('cada entrada apunta a un archivo que existe', () => {
    expect(ROUTE_TABLE.filter((r) => !existsSync(join(appDir, r.file))).map((r) => r.file)).toEqual([]);
  });

  test('el mapa de React Router sale de la tabla, sin rutas por fuera', () => {
    const fromRouter = routes.map((r) => `${r.index ? '' : r.path}→${r.file}`).sort();
    const fromTable = ROUTE_TABLE.map((r) => `${r.path}→${r.file}`).sort();
    expect(fromRouter).toEqual(fromTable);
  });

  test('⛔ solo las rutas de auth/ son públicas', () => {
    const wrong = ROUTE_TABLE.filter((r) => r.access === 'public' && !r.path.startsWith('auth/')).map((r) => r.path);
    expect(wrong).toEqual([]);
  });

  test('⛔ cada ruta de módulo pide un nivel que su módulo admite', () => {
    const wrong = ROUTE_TABLE.flatMap((r) =>
      typeof r.access === 'object' && !MODULE_LEVELS[r.access.module]?.includes(r.access.level) ? [r.path] : [],
    );
    expect(wrong).toEqual([]);
  });
});
