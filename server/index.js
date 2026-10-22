// El servidor del panel en producción (`npm start`, después de `npm run build`). El mismo archivo
// corre en una Lambda Web Function, en la Lambda clásica con Web Adapter y en la máquina de quien
// lo prueba: la diferencia es solo dónde escucha (`direccion.js`).
//
// Hace dos cosas, y nada más: servir los archivos estáticos del build y pasarle todo lo demás a
// React Router. La sesión, los permisos, la protección CSRF y las cabeceras viven en el
// middleware de React Router (`app/middleware/`), para que corran igual en `npm run dev`.
import express from 'express';
import { createRequestHandler } from '@react-router/express';
import { listenAddress } from './listen-address.js';

const app = express();
app.disable('x-powered-by');

// Los archivos con hash en el nombre no cambian nunca: se pueden guardar un año.
app.use('/assets', express.static('build/client/assets', { immutable: true, maxAge: '1y' }));
app.use(express.static('build/client', { maxAge: '1h', index: false }));

// Por variable y no literal: así TypeScript no revisa el build, que es código generado.
const SERVER_BUILD = '../build/server/index.js';
/** @type {() => Promise<import('react-router').ServerBuild>} */
const build = () => import(SERVER_BUILD);
app.all('*splat', createRequestHandler({ build }));

const { host, port } = listenAddress(process.env);
const server = app.listen(port, host, () => {
  const { port: actual } = /** @type {import('node:net').AddressInfo} */ (server.address());
  console.log(`aios-admin escuchando en http://${host}:${actual}`);
});
