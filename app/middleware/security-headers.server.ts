// Las cabeceras de seguridad de cada respuesta del panel (CA-28).
//
// La CSP (Content Security Policy: de dónde puede cargar scripts y estilos la página) solo deja
// correr scripts propios o con el *nonce* de este pedido. Con un servidor intermedio, un XSS
// actúa como la persona que tiene la sesión, y ni SameSite ni `Origin` lo frenan: lo frena esto.
// El nonce nace aquí, viaja en el contexto y lo usan `entry.server.tsx` y `root.tsx` para
// marcar los scripts que mete React Router.
import { randomBytes } from 'node:crypto';
import { createContext, type MiddlewareFunction } from 'react-router';

/** El nonce de la CSP de este pedido. Vacío si no pasó por el middleware. */
export const nonceContext = createContext<string>('');

/** La política, con el nonce del pedido. Sin `unsafe-inline` ni `unsafe-eval` en scripts. */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Las que van en toda respuesta, HTML o no. `no-store` porque todo lo que responde el panel es
 * de la persona que entró: ni el navegador (el «atrás» después de salir, en un computador
 * compartido) ni nada en el camino debe guardarlo. Los estáticos con hash no pasan por aquí.
 */
const ALWAYS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

/**
 * La CSP va en todo menos `npm run dev`: el servidor de Vite mete scripts propios para la recarga
 * instantánea, y la CSP los bloquearía.
 *
 * ⚠️ No sale de `import.meta.env.DEV`: ese valor lo decide `NODE_ENV` al construir, y un build
 * hecho con `NODE_ENV=development` (o `test`) saldría a AWS sin CSP y sin aviso. La marca
 * `__PANEL_DEV_SERVER__` la define solo el servidor de desarrollo (`vite.config.ts`).
 */
export const CSP_ENABLED = typeof __PANEL_DEV_SERVER__ === 'undefined';

export const createNonce = () => randomBytes(16).toString('base64');

/** Pone las cabeceras de seguridad en `headers`; la CSP, solo en una página HTML y con `csp`. */
export function applySecurityHeaders(headers: Headers, { nonce, csp, html }: { nonce: string; csp: boolean; html: boolean }) {
  for (const [name, value] of Object.entries(ALWAYS)) headers.set(name, value);
  if (csp && html) headers.set('Content-Security-Policy', contentSecurityPolicy(nonce));
}

/**
 * El middleware. ⚠️ Una ruta que no existe (404) la responde React Router sin correr ningún
 * middleware: para esa página, `entry.server.tsx` pone las mismas cabeceras.
 */
export function securityHeadersMiddleware({ csp }: { csp: boolean }): MiddlewareFunction<Response> {
  return async ({ context }, next) => {
    const nonce = createNonce();
    context.set(nonceContext, nonce);
    const response = await next();

    // Copia y no modificación: las cabeceras de algunas respuestas (un redirect) son de solo lectura.
    const headers = new Headers(response.headers);
    applySecurityHeaders(headers, { nonce, csp, html: headers.get('content-type')?.startsWith('text/html') ?? false });
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
