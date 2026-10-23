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
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Plugin } from 'vite';
import { DEV_IDENTITY_MARKER } from '../dev/identity/login-page';
import { forbidDevImports } from '../tooling/forbid-dev-imports';
import { CLIENT_ID, CLIENT_SECRET, ISSUER, LOGIN_URL, ORIGIN, TEST_ENV } from './helpers/fake-cognito';

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

describe('el servidor construido, arrancando como en AWS (CB-12)', () => {
  /** Lo que el servidor lee de SSM en esta prueba; el resto de la configuración va en el entorno. */
  const SSM_VALUES: Record<string, string> = { '/aios-admin/public-origins': ORIGIN, '/aios/admin/api-url': 'https://api.example' };
  const SSM_MAP = { PUBLIC_ORIGINS: '/aios-admin/public-origins', ADMIN_API_URL: '/aios/admin/api-url' };
  /** Arrancar el proceso y cargar el build tarda; con esto de margen, uno colgado no cuelga la suite. */
  const DEADLINE_MS = 10_000;

  const bodyOf = async (req: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  };

  /** Un SSM falso que retiene su respuesta hasta `release()`: así se ve qué hace el servidor mientras espera. */
  async function heldSsm() {
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    const asked: string[][] = [];
    const server: Server = createServer(async (req, res) => {
      const { Names } = JSON.parse(await bodyOf(req)) as { Names: string[] };
      asked.push(Names);
      await held;
      res.writeHead(200, { 'content-type': 'application/x-amz-json-1.1' });
      res.end(JSON.stringify({ Parameters: Names.map((Name) => ({ Name, Value: SSM_VALUES[Name] })), InvalidParameters: [] }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { asked, release, server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  }

  /** La dirección en la que quedó escuchando. **Lanza** si no escucha antes del plazo. */
  function listeningAt(child: ChildProcessWithoutNullStreams): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error(`el servidor no escuchó en ${DEADLINE_MS} ms`)), DEADLINE_MS);
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
        const address = /escuchando en (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1];
        if (address) { clearTimeout(timer); resolvePromise(address); }
      });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`el servidor terminó con ${code}`)); });
    });
  }

  /** Pide `url` hasta que responda 200. **Lanza** si no pasa antes del plazo. */
  async function untilReady(url: string): Promise<Response> {
    const deadline = Date.now() + DEADLINE_MS;
    while (Date.now() < deadline) {
      const response = await fetch(url);
      if (response.status === 200) return response;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    throw new Error(`${url} no respondió 200 en ${DEADLINE_MS} ms`);
  }

  test('⛔ escucha antes de leer SSM, responde 503 mientras tanto, y entra en servicio con lo que leyó', async () => {
    const ssm = await heldSsm();
    // Un entorno mínimo, sin heredar el de quien corre la prueba: ninguna credencial ni perfil de AWS
    // real puede colarse. El SDK habla con el SSM falso por su variable de endpoint.
    const child = spawn(process.execPath, [join(root, 'server', 'index.js')], {
      env: {
        PANEL_BUILD_DIR: outDir, PORT: '0', NODE_ENV: 'production', SESSION_STORE: 'memory',
        COGNITO_LOGIN_URL: LOGIN_URL, COGNITO_ISSUER: ISSUER, COGNITO_CLIENT_ID: CLIENT_ID, COGNITO_CLIENT_SECRET: CLIENT_SECRET,
        PANEL_SSM_PARAMETERS: JSON.stringify(SSM_MAP), AWS_ENDPOINT_URL_SSM: ssm.url, AWS_REGION: 'us-east-2',
        AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test',
        AWS_CONFIG_FILE: join(outDir, 'sin-config'), AWS_SHARED_CREDENTIALS_FILE: join(outDir, 'sin-credenciales'),
      },
    });
    try {
      const base = await listeningAt(child);
      const waiting = await fetch(`${base}/auth/no-access`);
      expect(waiting.status).toBe(503);
      expect(waiting.headers.get('retry-after')).toBe('5');
      ssm.release();
      const ready = await untilReady(`${base}/auth/no-access`);
      expect(ready.headers.get('content-security-policy')).toContain("'nonce-");
      expect(ssm.asked).toEqual([Object.values(SSM_MAP)]);
    } finally {
      child.kill();
      if (child.exitCode === null) await once(child, 'exit');
      ssm.server.close();
    }
  }, DEADLINE_MS * 2);
});
