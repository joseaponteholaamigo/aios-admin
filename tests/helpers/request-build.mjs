// Pide páginas a un build del panel con Node a secas, como en producción, e imprime las respuestas
// en JSON. Lo usa `tests/production-build.test.ts`.
//
// ⚠️ Corre en su propio proceso y no dentro de vitest: vitest carga su propia copia de
// `react-router`, distinta de la que importa el build, y con dos copias el middleware no corre.
//
// Uso: node request-build.mjs <build/server/index.js> <origen> <ruta> [<ruta>…]
import { pathToFileURL } from 'node:url';
import { createRequestHandler } from 'react-router';

const [buildFile, origin, ...paths] = process.argv.slice(2);
if (!buildFile || !origin) throw new Error('Uso: node request-build.mjs <build/server/index.js> <origen> <ruta> [<ruta>…]');
const build = await import(pathToFileURL(buildFile).href);
const handle = createRequestHandler(build, 'production');
const responses = [];
for (const path of paths) {
  const response = await handle(new Request(`${origin}${path}`));
  responses.push({ path, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
}
process.stdout.write(JSON.stringify(responses));
