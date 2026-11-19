#!/usr/bin/env node
// Arma el paquete que corre en la Lambda Web Function (`.lambda-asset/`), por allow-list.
//
// Uso: `npm run lambda:asset` (construye el panel y después corre esto).
//
// ⚠️ Se enumera lo que SÍ viaja, nunca lo que no: una lista de exclusión fallaría en silencio ante
// cada archivo nuevo. Y al final se revisa el paquete contra `FORBIDDEN`: la identidad falsa de
// `dev/` deja entrar a cualquiera como superadministrador, y un `.env` o una clave no pueden
// llegar a la nube. Si algo de eso aparece, el script aborta.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DESTINATION = join(ROOT, '.lambda-asset');

/** Lo único que viaja, con el porqué de cada pieza. */
export const INCLUDED = [
  { path: 'build/server', why: 'el servidor de React Router, ya compilado' },
  { path: 'build/client', why: 'los estáticos: CloudFront los sirve desde S3, pero el servidor también sabe servirlos' },
  { path: 'server', why: 'Express: escucha, lee su configuración de SSM y le pasa los pedidos a React Router' },
  { path: 'package.json', why: '"type": "module" y la lista de dependencias de producción' },
  { path: 'package-lock.json', why: 'npm ci instala exactamente las versiones con que corren las pruebas' },
];

/** Lo que nunca puede estar en el paquete, aunque una entrada de `INCLUDED` lo arrastrara. */
export const FORBIDDEN = [
  { pattern: /^dev(\/|$)/, why: 'la identidad falsa de desarrollo' },
  { pattern: /^(app|tests|tooling|infra|specs|scripts)(\/|$)/, why: 'código fuente, pruebas o infraestructura' },
  { pattern: /(^|\/)\.env(\.|$)/, why: 'variables locales, que pueden llevar secretos' },
  { pattern: /\.(pem|key|p12|pfx)$/, why: 'una clave privada' },
];

/**
 * Las rutas del paquete que no deberían estar, con su motivo. Vacío si está limpio. `node_modules/`
 * no se revisa: sale de `npm ci` con el lock, y hay dependencias que traen claves de ejemplo.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function forbiddenEntries(paths) {
  return paths
    .filter((path) => !path.startsWith('node_modules/'))
    .flatMap((path) => FORBIDDEN.filter(({ pattern }) => pattern.test(path)).map(({ why }) => `${path}: ${why}`));
}

/** @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** @param {string[]} files */
function sizeInMb(files) {
  return (files.reduce((total, file) => total + statSync(file).size, 0) / 1024 / 1024).toFixed(1);
}

export function buildLambdaAsset() {
  if (!existsSync(join(ROOT, 'build', 'server', 'index.js'))) throw new Error('Falta el build: corre primero npm run build');
  rmSync(DESTINATION, { recursive: true, force: true });
  mkdirSync(DESTINATION, { recursive: true });
  for (const { path } of INCLUDED) cpSync(join(ROOT, path), join(DESTINATION, path), { recursive: true });
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: DESTINATION,
    stdio: 'inherit',
  });
  const files = filesUnder(DESTINATION);
  const wrong = forbiddenEntries(files.map((file) => relative(DESTINATION, file).split(sep).join('/')));
  if (wrong.length > 0) throw new Error(`El paquete lleva lo que no debe:\n${wrong.join('\n')}`);
  console.log(`Paquete listo en ${relative(ROOT, DESTINATION)}: ${files.length} archivos, ${sizeInMb(files)} MB sin comprimir (el tope es 512 MB).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildLambdaAsset();
