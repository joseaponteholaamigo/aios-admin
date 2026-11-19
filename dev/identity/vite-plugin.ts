// El enchufe de la identidad falsa en `npm run dev`. Es un plugin de Vite que solo se aplica al
// servidor de desarrollo (`apply: 'serve'`): el build no lo carga, y nada de `app/` importa de
// `dev/` (lo frena `tooling/forbid-dev-imports.ts`). En AWS, esta identidad no existe (CA-29).
//
// ⚠️ Sin importaciones de código propio: este archivo entra al grafo de `vite.config.ts`, y el
// resto de la identidad lo carga Vite (`ssrLoadModule`) al arrancar el servidor.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const FACTORY = '/dev/identity/factory.ts';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

async function send(response: Response, res: ServerResponse) {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function devIdentityPlugin(): Plugin {
  return {
    name: 'aios-admin-dev-identity',
    apply: 'serve',
    async configureServer(server) {
      const { devIdentityFromEnv, DEV_IDENTITY_PATH } = (await server.ssrLoadModule(FACTORY)) as typeof import('./factory');
      const identity = devIdentityFromEnv(process.env);
      if (!identity) {
        server.config.logger.info('Identidad falsa apagada: COGNITO_ISSUER apunta a otro proveedor.');
        return;
      }
      server.config.logger.info(`Identidad falsa en ${DEV_IDENTITY_PATH} (solo desarrollo).`);
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(`${DEV_IDENTITY_PATH}/`)) return next();
        toRequest(req)
          .then((request) => identity(request))
          .then((response) => (response ? send(response, res) : next()))
          .catch(next);
      });
    },
  };
}
