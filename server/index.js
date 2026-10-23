// El servidor del panel en producción (`npm start`, después de `npm run build`). El mismo archivo
// corre en una Lambda Web Function, en la Lambda clásica con Web Adapter y en la máquina de quien
// lo prueba: la diferencia es solo dónde escucha (`listen-address.js`) y de dónde sale su
// configuración (en AWS, de SSM: `runtime-config.js`).
//
// Hace tres cosas, y nada más: servir los archivos estáticos del build, arrancar en dos tiempos
// (`startup.js`) y pasarle todo lo demás a React Router. La sesión, los permisos, la protección
// CSRF y las cabeceras viven en el middleware de React Router (`app/middleware/`), para que corran
// igual en `npm run dev`.
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { createRequestHandler } from '@react-router/express';
import { listenAddress } from './listen-address.js';
import { actionOriginHosts } from './action-origins.js';
import { ensureRegion, readSsmParameters, ssmParameterMap } from './runtime-config.js';
import { createStartup } from './startup.js';

// El build se busca junto a este archivo, no en la carpeta desde la que se lanzó el proceso (en
// Lambda no es la del paquete). `PANEL_BUILD_DIR` existe solo para las pruebas del build.
const BUILD_DIR = resolve(process.env.PANEL_BUILD_DIR ?? fileURLToPath(new URL('../build', import.meta.url)));

const app = express();
app.disable('x-powered-by');

// Los archivos con hash en el nombre no cambian nunca: se pueden guardar un año.
app.use('/assets', express.static(resolve(BUILD_DIR, 'client', 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(resolve(BUILD_DIR, 'client'), { maxAge: '1h', index: false }));

const startup = createStartup({
  async loadEnvironment() {
    const map = ssmParameterMap(process.env);
    if (map) Object.assign(process.env, await readSsmParameters(map));
  },
  async loadApp() {
    // Al cargarse, el build valida la configuración (`entry.server.tsx`): si falta o está mal una
    // variable, se detiene aquí, con su nombre.
    const build = /** @type {import('react-router').ServerBuild} */ (await import(pathToFileURL(resolve(BUILD_DIR, 'server', 'index.js')).href));
    // Detrás de CloudFront, React Router rechazaría cada formulario: ver `action-origins.js`.
    return createRequestHandler({ build: { ...build, allowedActionOrigins: actionOriginHosts(process.env) } });
  },
  onFatal(error) {
    console.error('El panel no puede arrancar con esta configuración:', error instanceof Error ? error.message : error);
    process.exit(1);
  },
});

app.all('*splat', async (req, res, next) => {
  const handle = await startup.waitForHandler();
  if (handle) return handle(req, res, next);
  res
    .status(503)
    .set({
      'Retry-After': '5',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    })
    .type('text/plain; charset=utf-8')
    .send('El panel está arrancando. Vuelve a intentarlo en unos segundos.');
});

ensureRegion(process.env);

const { host, port } = listenAddress(process.env);
const server = app.listen(port, host, () => {
  const { port: actual } = /** @type {import('node:net').AddressInfo} */ (server.address());
  console.log(`aios-admin escuchando en http://${host}:${actual}`);
  void startup.start();
});
