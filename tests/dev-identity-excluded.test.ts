// La identidad falsa nunca llega al build que se despliega (CA-29).
//
// EL DEFECTO QUE PREVIENE. La identidad falsa deja entrar a cualquiera como superadministrador con
// un clic. Si se colara en el build, el panel en AWS tendría una puerta sin contraseña ni MFA.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { Plugin } from 'vite';
import { DEV_IDENTITY_MARKER } from '../dev/identity/login-page';
import { forbidDevImports } from '../tooling/forbid-dev-imports';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REACT_ROUTER_CLI = join(root, 'node_modules', '@react-router', 'dev', 'bin.cjs');
/** El build real tarda unos segundos; con esto de margen, un build colgado no cuelga la suite. */
const BUILD_TIMEOUT_MS = 60_000;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('el build sin la identidad falsa', () => {
  // ⏱ Pasa el techo de 1 s a propósito: corre `react-router build` de verdad, en una carpeta
  // temporal, porque lo que se prueba es la salida del build y no ninguna función suelta.
  test('⛔ la salida no lleva la identidad falsa', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'aios-admin-build-'));
    try {
      execFileSync(process.execPath, [REACT_ROUTER_CLI, 'build'], {
        cwd: root, env: { ...process.env, PANEL_BUILD_DIR: outDir }, stdio: 'pipe', timeout: BUILD_TIMEOUT_MS,
      });
      const files = filesUnder(outDir);
      // Que el build salió de verdad: sin esto, una carpeta vacía pasaría la prueba.
      expect(files.some((f) => readFileSync(f, 'utf8').includes('Panel ensō'))).toBe(true);
      expect(files.filter((f) => readFileSync(f, 'utf8').includes(DEV_IDENTITY_MARKER))).toEqual([]);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, BUILD_TIMEOUT_MS);

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
});
