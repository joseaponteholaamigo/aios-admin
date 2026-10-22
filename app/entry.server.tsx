// El render del servidor. Es el de React Router para Node, con tres cambios:
//   1. Los scripts que mete React Router llevan el nonce de la CSP de este pedido
//      (`security-headers.server.ts`); sin él, la CSP los bloquearía.
//   2. Una página que no pasó por el middleware (una ruta que no existe: React Router responde el
//      404 sin correrlo) recibe aquí las mismas cabeceras de seguridad (CA-28).
//   3. La configuración se valida al cargar el build: un panel mal configurado no arranca, en vez
//      de arrancar y aceptar de más (CB-11). En producción, `server/index.js` carga el build antes
//      de escuchar.
import { PassThrough } from 'node:stream';
import type { EntryContext, RouterContextProvider } from 'react-router';
import { ServerRouter } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { isbot } from 'isbot';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';
import { getConfig } from './shared/config/config.server';
import { CSP_ENABLED, applySecurityHeaders, createNonce, nonceContext } from './middleware/security-headers.server';

getConfig();

export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  const middlewareNonce = loadContext.get(nonceContext);
  const nonce = middlewareNonce || createNonce();
  if (!middlewareNonce) applySecurityHeaders(responseHeaders, { nonce, csp: CSP_ENABLED, html: true });
  if (request.method.toUpperCase() === 'HEAD') {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }

  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get('user-agent');
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady';

    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort(), streamTimeout + 1000);

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
      {
        nonce,
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          responseHeaders.set('Content-Type', 'text/html');
          pipe(body);
          resolve(new Response(createReadableStreamFromReadable(body), { headers: responseHeaders, status: responseStatusCode }));
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) console.error(error);
        },
      },
    );
  });
}
