// El build de producción, construido de verdad una sola vez para todo el archivo (CA-28, CA-29).
//
// EL DEFECTO QUE PREVIENE. La identidad falsa deja entrar a cualquiera como superadministrador con
// un clic: si se colara en el build, el panel en AWS tendría una puerta sin contraseña ni MFA. Y
// la CSP: en las pruebas corre en modo desarrollo, donde va apagada, así que si alguien la apagara
// también en producción, ninguna otra prueba lo notaría. Solo el build real lo dice.
//
// ⏱ Pasa el techo de 1 s a propósito: corre `react-router build` de verdad (unos segundos), porque
// lo que se prueba es la salida del build y no ninguna función suelta.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Plugin } from 'vite';
import { DEV_IDENTITY_MARKER } from '../dev/identity/login-page';
import { forbidDevImports } from '../tooling/forbid-dev-imports';
import { ORIGIN, TEST_ENV } from './helpers/fake-cognito';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REACT_ROUTER_CLI = join(root, 'node_modules', '@react-router', 'dev', 'bin.cjs');
/** El build real tarda unos segundos; con esto de margen, un build colgado no cuelga la suite. */
const BUILD_TIMEOUT_MS = 60_000;

const REQUEST_BUILD = join(root, 'tests', 'helpers', 'request-build.mjs');

let outDir: string;

type BuiltResponse = { path: string; status: number; headers: Record<string, string>; body: string };

/** Pide `paths` al build con Node a secas (ver `helpers/request-build.mjs`). */
function requestBuild(paths: string[]): BuiltResponse[] {
  const output = execFileSync(process.execPath, [REQUEST_BUILD, join(outDir, 'server', 'index.js'), ORIGIN, ...paths], {
    cwd: root, env: { ...process.env, ...TEST_ENV }, stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(output.toString('utf8')) as BuiltResponse[];
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

beforeAll(() => {
  // Dentro de `node_modules/.cache` y no en el temporal del sistema: el servidor construido importa
  // react y react-router, y Node los busca subiendo carpetas desde el archivo. Se borra al terminar.
  // El servidor valida su configuración al cargarse: `requestBuild` le pasa la de prueba.
  const cache = join(root, 'node_modules', '.cache');
  mkdirSync(cache, { recursive: true });
  outDir = mkdtempSync(join(cache, 'aios-admin-build-'));
  // Construye con el `NODE_ENV=test` que hereda de vitest, a propósito: la CSP no puede depender de
  // con qué `NODE_ENV` se construyó (ver `CSP_ENABLED`).
  expect(process.env.NODE_ENV).not.toBe('production');
  execFileSync(process.execPath, [REACT_ROUTER_CLI, 'build'], {
    cwd: root, env: { ...process.env, PANEL_BUILD_DIR: outDir }, stdio: 'pipe', timeout: BUILD_TIMEOUT_MS,
  });
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('el build de producción', () => {
  test('⛔ no lleva la identidad falsa', () => {
    const files = filesUnder(outDir);
    // Que el build salió de verdad: sin esto, una carpeta vacía pasaría la prueba.
    expect(files.some((f) => readFileSync(f, 'utf8').includes('Panel ensō'))).toBe(true);
    expect(files.filter((f) => readFileSync(f, 'utf8').includes(DEV_IDENTITY_MARKER))).toEqual([]);
  });

  test('⛔ cada página lleva la CSP encendida, y cada script de la página lleva su nonce', () => {
    const expected = { '/auth/no-access': 200, '/no-existe': 404 };
    const responses = requestBuild(Object.keys(expected));
    expect(responses).toHaveLength(2);
    for (const { path, status, headers, body } of responses) {
      const csp = headers['content-security-policy'] ?? '';
      const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
      const scripts = [...body.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
      expect(status, path).toBe(expected[path as keyof typeof expected]);
      expect(nonce, `${path}: ${csp}`).toBeTruthy();
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(scripts.length, path).toBeGreaterThan(0);
      expect(scripts.filter((s) => !s.includes(`nonce="${nonce}"`)), path).toEqual([]);
    }
  });
});

test('⛔ el build se detiene si un archivo de app/ importa de dev/', () => {
  const plugin = forbidDevImports(root);
  const resolveId = plugin.resolveId as (this: unknown, source: string, importer: string | undefined) => unknown;
  const context = { error: (message: string) => { throw new Error(message); } };
  const from = (file: string, source: string) => () => resolveId.call(context, source, join(root, file));
  expect(from('app/shared/api/x.ts', '../../../dev/identity/login-page')).toThrow(/dev\//);
  expect(from('app/shared/api/x.ts', '../../domain/permissions')()).toBeNull();
  expect(from('dev/identity/x.ts', '../../app/domain/permissions')()).toBeNull();
  expect((plugin as Plugin).apply).toBe('build');
});
