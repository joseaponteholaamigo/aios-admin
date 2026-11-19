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

describe('la plantilla visual en el build', () => {
  /** Las caras que pide `app/styles/fonts.css`: latín y latín extendido de cada peso. */
  const EXPECTED_FONTS = [
    ...[400, 500, 600, 700].map((w) => `inter-tight-%-${w}-normal.woff2`),
    ...[400, 500, 700].map((w) => `jetbrains-mono-%-${w}-normal.woff2`),
  ].flatMap((name) => [name.replace('%', 'latin'), name.replace('%', 'latin-ext')]).sort();

  test('⛔ las tipografías salen del propio panel: solo woff2, solo latín y latín extendido, y nada de Google (CA-24)', () => {
    const assets = join(outDir, 'client', 'assets');
    const fonts = readdirSync(assets).filter((name) => /\.(woff2?|ttf|otf|eot)$/.test(name));
    // Sin el hash que agrega Vite: `inter-tight-latin-400-normal-AbC12.woff2` → `inter-tight-latin-400-normal.woff2`.
    expect(fonts.map((name) => name.replace(/-[\w-]{8}\.woff2$/, '.woff2')).sort()).toEqual(EXPECTED_FONTS);
    const google = filesUnder(outDir).filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(f, 'utf8')));
    expect(google).toEqual([]);
  });

  test('la página sin sesión lleva la hoja del panel, el tema antes de pintar y el marco público, sin menú (CA-23, CA-25)', () => {
    const [page] = requestBuild(['/auth/no-access']);
    const body = page?.body ?? '';
    const head = body.slice(0, body.indexOf('</head>'));
    expect(page?.status).toBe(200);
    expect(head).toMatch(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\/root-[\w-]+\.css"/);
    // El script del tema va en el <head> y antes de las hojas: fija el tema antes del primer cuadro.
    const themeScript = head.indexOf('enso-theme');
    expect(themeScript).toBeGreaterThan(-1);
    expect(themeScript).toBeLessThan(head.indexOf('rel="stylesheet"'));
    expect(body).toContain('<body class="adm">');
    expect(body).toContain('class="adm-public"');
    expect(body).not.toContain('adm-side');
  });

  test('⛔ en la hoja del panel, los tokens y las primitivas van antes que el marco (el botón del menú no aparece en el escritorio)', () => {
    const assets = join(outDir, 'client', 'assets');
    const sheets = readdirSync(assets).filter((name) => /^root-[\w-]+\.css$/.test(name));
    expect(sheets).toHaveLength(1);
    const css = readFileSync(join(assets, sheets[0]!), 'utf8');
    const at = (rule: string) => css.indexOf(rule);
    // `.adm-menu { display: none }` tiene la misma especificidad que `.adm-iconbtn { display: grid }`:
    // gana el que va después. Con la hoja global al final, el botón del teléfono se veía siempre.
    expect(at('--bg:')).toBeGreaterThan(-1);
    expect(at('--bg:')).toBeLessThan(at('.adm-iconbtn{'));
    expect(at('.adm-iconbtn{')).toBeLessThan(at('.adm-menu{'));
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

  /**
   * Un SSM falso que retiene su respuesta hasta `release()`: así se ve qué hace el servidor mientras
   * espera. Con `missing`, responde que los parámetros no existen (el backend sin su segunda pasada).
   */
  async function fakeSsm({ missing = false } = {}) {
    let release = () => {};
    const held = missing ? Promise.resolve() : new Promise<void>((resolve) => { release = resolve; });
    const asked: string[][] = [];
    const server: Server = createServer(async (req, res) => {
      const { Names } = JSON.parse(await bodyOf(req)) as { Names: string[] };
      asked.push(Names);
      await held;
      res.writeHead(200, { 'content-type': 'application/x-amz-json-1.1' });
      res.end(JSON.stringify(missing
        ? { Parameters: [], InvalidParameters: Names }
        : { Parameters: Names.map((Name) => ({ Name, Value: SSM_VALUES[Name] })), InvalidParameters: [] }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { asked, release, server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  }

  /**
   * Arranca el servidor construido contra el SSM falso. Con un entorno mínimo, sin heredar el de
   * quien corre la prueba: ninguna credencial ni perfil de AWS real puede colarse.
   */
  function startServer(ssmUrl: string): ChildProcessWithoutNullStreams {
    return spawn(process.execPath, [join(root, 'server', 'index.js')], {
      env: {
        PANEL_BUILD_DIR: outDir, PORT: '0', NODE_ENV: 'production', SESSION_STORE: 'memory',
        COGNITO_LOGIN_URL: LOGIN_URL, COGNITO_ISSUER: ISSUER, COGNITO_CLIENT_ID: CLIENT_ID, COGNITO_CLIENT_SECRET: CLIENT_SECRET,
        PANEL_SSM_PARAMETERS: JSON.stringify(SSM_MAP), AWS_ENDPOINT_URL_SSM: ssmUrl, AWS_REGION: 'us-east-2',
        AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test',
        AWS_CONFIG_FILE: join(outDir, 'sin-config'), AWS_SHARED_CREDENTIALS_FILE: join(outDir, 'sin-credenciales'),
      },
    });
  }

  async function stop(child: ChildProcessWithoutNullStreams, ssm: { server: Server }) {
    child.kill();
    if (child.exitCode === null) await once(child, 'exit');
    ssm.server.close();
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

  /** Espera a que `condition` se cumpla. **Lanza** si no pasa antes del plazo. */
  async function until(condition: () => boolean, what: string) {
    const deadline = Date.now() + DEADLINE_MS;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error(`${what}: no pasó en ${DEADLINE_MS} ms`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    }
  }

  test('⛔ escucha antes de leer SSM, y el pedido que llega mientras tanto espera y recibe la página (el arranque en frío no falla)', async () => {
    const ssm = await fakeSsm();
    const child = startServer(ssm.url);
    try {
      const base = await listeningAt(child);
      const pending = fetch(`${base}/auth/no-access`);
      await until(() => ssm.asked.length === 1, 'el servidor pidió su configuración');
      ssm.release();
      const response = await pending;
      expect(response.status).toBe(200);
      expect(response.headers.get('content-security-policy')).toContain("'nonce-");
      expect(ssm.asked).toEqual([Object.values(SSM_MAP)]);
    } finally {
      await stop(child, ssm);
    }
  }, DEADLINE_MS * 2);

  test('⛔ si faltan parámetros (el backend todavía no hizo su segunda pasada), responde 503 enseguida', async () => {
    const ssm = await fakeSsm({ missing: true });
    const child = startServer(ssm.url);
    try {
      const base = await listeningAt(child);
      await until(() => ssm.asked.length === 1, 'el servidor pidió su configuración');
      const startedAt = Date.now();
      const response = await fetch(`${base}/auth/no-access`);
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      expect(Date.now() - startedAt).toBeLessThan(2000);
    } finally {
      await stop(child, ssm);
    }
  }, DEADLINE_MS * 2);
});
