// El marco de todas las páginas: <html>, metadatos, scripts y el middleware que corre en cada
// pedido. Sin pantallas: cada una vive en su módulo (`app/modules/`), y el mapa de rutas está en
// `app/routes.ts`.
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteLoaderData } from 'react-router';
import type { Route } from './+types/root';
import { nonceContext, securityHeadersMiddleware } from './middleware/security-headers.server';
import { csrfMiddleware } from './middleware/csrf.server';
import { sessionMiddleware } from './middleware/session.server';
import { authMiddleware } from './middleware/auth.server';

/**
 * En orden: las cabeceras envuelven todo (también un rechazo de CSRF); después la protección
 * CSRF, antes de que corra cualquier *action*; la sesión, que deja en el contexto quién pide; y
 * el acceso, que manda al login a quien no tiene sesión y renueva el access token. La CSP no va
 * en `npm run dev` (ver el middleware).
 */
export const middleware: Route.MiddlewareFunction[] = [
  securityHeadersMiddleware({ csp: !import.meta.env.DEV }),
  csrfMiddleware(),
  sessionMiddleware(),
  authMiddleware(),
];

/** El nonce de la CSP de este pedido, para marcar los scripts del documento. */
export function loader({ context }: Route.LoaderArgs) {
  return { nonce: context.get(nonceContext) };
}

export function Layout({ children }: { children: ReactNode }) {
  const nonce = useRouteLoaderData<typeof loader>('root')?.nonce || undefined;
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Panel ensō' }];
}

/** El error que ve la persona: sin detalles técnicos ni trazas (plan §3.3). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main>
      <h1>{notFound ? 'No encontramos esa página' : 'Algo salió mal'}</h1>
      <p>Vuelve a intentarlo. Si sigue pasando, avísale al equipo.</p>
    </main>
  );
}
