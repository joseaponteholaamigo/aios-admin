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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(root, 'app');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Las importaciones de un archivo; las locales, resueltas a rutas relativas a `app/`. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const raw = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
  return raw.map((i) => (i.startsWith('.') ? relative(appDir, resolve(dirname(file), i)).split(sep).join('/') : i));
}

const files = filesUnder(appDir).filter((f) => /\.(tsx?|jsx?|css)$/.test(f));
const rel = (f: string) => relative(appDir, f).split(sep).join('/');
const moduleOf = (r: string) => (r.startsWith('modules/') ? r.split('/')[1] : null);

test('hay archivos que revisar', () => {
  expect(files.length).toBeGreaterThan(0);
});

test('los archivos de app/ van en kebab-case', () => {
  const wrong = files.map(rel).filter((r) => r.split('/').some((part) => !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(part)));
  expect(wrong).toEqual([]);
});

test('un módulo nunca importa de otro módulo', () => {
  const crossings = files.flatMap((f) => {
    const own = moduleOf(rel(f));
    if (!own) return [];
    return importsOf(f)
      .filter((i) => moduleOf(i) && moduleOf(i) !== own)
      .map((i) => `${rel(f)} → ${i}`);
  });
  expect(crossings).toEqual([]);
});

test('⛔ nada de app/ importa de dev/: la identidad falsa no llega al build (CA-29)', () => {
  const wrong = files.flatMap((f) => importsOf(f).filter((i) => i === '../dev' || i.startsWith('../dev/')).map((i) => `${rel(f)} → ${i}`));
  expect(wrong).toEqual([]);
});

test('shared/ y domain/ nunca importan de un módulo, y domain/ no usa React', () => {
  const wrong = files.flatMap((f) => {
    const r = rel(f);
    if (!r.startsWith('shared/') && !r.startsWith('domain/')) return [];
    return importsOf(f)
      .filter((i) => moduleOf(i) || (r.startsWith('domain/') && /^react(-dom|-router)?(\/|$)/.test(i)))
      .map((i) => `${r} → ${i}`);
  });
  expect(wrong).toEqual([]);
});
