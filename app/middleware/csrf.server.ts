// La protección contra pedidos falsificados (CSRF) del panel (CA-27).
//
// Cada pedido que cambia algo (todo lo que no es GET, HEAD u OPTIONS) tiene que venir de uno de
// los orígenes del panel. Se compara la cabecera `Origin` contra la lista fija de la
// configuración, nunca contra el `Host` del pedido: detrás de CloudFront, el servidor ve el
// dominio del endpoint de Lambda. Si no llega `Origin`, solo se acepta `Sec-Fetch-Site:
// same-origin`, que el navegador pone y una página ajena no puede falsificar.
import type { MiddlewareFunction } from 'react-router';
import { getConfig } from '../shared/config/config.server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** ¿Este pedido puede cambiar algo en nombre de quien tiene la sesión? */
export function isAllowedRequest(request: Request, publicOrigins: readonly string[]): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get('origin');
  if (origin) return publicOrigins.includes(origin);
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

/** El middleware. Corta con 403 antes de que corra ninguna *action*. */
export function csrfMiddleware(
  origins: () => readonly string[] = () => getConfig().publicOrigins,
): MiddlewareFunction<Response> {
  return async ({ request }, next) => {
    if (!isAllowedRequest(request, origins())) {
      throw new Response('Este pedido no viene del panel.', { status: 403 });
    }
    return next();
  };
}
