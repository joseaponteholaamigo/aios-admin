// Las reglas de organización del front (CA-17, y `~/.claude/CLAUDE.md` § Front-end organization).
//
// EL DEFECTO QUE PREVIENE. Las dependencias cruzadas entre módulos no rompen nada el día que se
// escriben: rompen cuando un módulo cambia y otro, que nadie sabía que dependía de él, se cae. Lo
// mismo con `shared/` o `domain/` importando un módulo, o con React colándose en las reglas de
// negocio. Esta prueba lo frena el día que pasa, con el archivo y la importación.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : [p];
  });
}

/** Las importaciones de un archivo, resueltas a rutas relativas a `app/` cuando son locales. */
function importaciones(archivo: string): string[] {
  const fuente = readFileSync(archivo, 'utf8');
  const crudas = [...fuente.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
  return crudas.map((i) => (i.startsWith('.') ? relative(app, resolve(dirname(archivo), i)).split(sep).join('/') : i));
}

const todos = archivos(app).filter((a) => /\.(tsx?|jsx?|css)$/.test(a));
const rel = (a: string) => relative(app, a).split(sep).join('/');
const moduloDe = (r: string) => (r.startsWith('modules/') ? r.split('/')[1] : null);

test('hay archivos que revisar', () => {
  expect(todos.length).toBeGreaterThan(0);
});

test('los archivos de app/ van en kebab-case', () => {
  const mal = todos.map(rel).filter((r) => r.split('/').some((parte) => !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(parte)));
  expect(mal).toEqual([]);
});

test('un módulo nunca importa de otro módulo', () => {
  const cruces = todos.flatMap((a) => {
    const propio = moduloDe(rel(a));
    if (!propio) return [];
    return importaciones(a)
      .filter((i) => moduloDe(i) && moduloDe(i) !== propio)
      .map((i) => `${rel(a)} → ${i}`);
  });
  expect(cruces).toEqual([]);
});

test('shared/ y domain/ nunca importan de un módulo, y domain/ no usa React', () => {
  const malas = todos.flatMap((a) => {
    const r = rel(a);
    if (!r.startsWith('shared/') && !r.startsWith('domain/')) return [];
    return importaciones(a)
      .filter((i) => moduloDe(i) || (r.startsWith('domain/') && /^react(-dom|-router)?(\/|$)/.test(i)))
      .map((i) => `${r} → ${i}`);
  });
  expect(malas).toEqual([]);
});
