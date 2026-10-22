// El marco de todas las páginas: <html>, metadatos, scripts, el menú y el middleware que corre en
// cada pedido. Sin pantallas: cada una vive en su módulo (`app/modules/`), y las rutas, con el
// acceso que exige cada una, están en `app/shared/routing/route-table.ts`.
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteLoaderData } from 'react-router';
import type { Route } from './+types/root';
import { CSP_ENABLED, nonceContext, securityHeadersMiddleware } from './middleware/security-headers.server';
import { csrfMiddleware } from './middleware/csrf.server';
import { sessionMiddleware } from './middleware/session.server';
import { authMiddleware } from './middleware/auth.server';
import { permissionsMiddleware, teamMemberContext } from './middleware/permissions.server';
import { menuFor } from './shared/routing/route-access';
import { MainNav } from './shared/layout/main-nav';

/**
 * En orden: las cabeceras envuelven todo (también un rechazo de CSRF); después la protección
 * CSRF, antes de que corra cualquier *action*; la sesión, que deja en el contexto quién pide; el
 * acceso, que manda al login a quien no tiene sesión y renueva el access token; y los permisos,
 * que piden `/yo` y niegan lo que la persona no puede abrir. La CSP no va en `npm run dev` (ver
 * el middleware).
 */
export const middleware: Route.MiddlewareFunction[] = [
  securityHeadersMiddleware({ csp: CSP_ENABLED }),
  csrfMiddleware(),
  sessionMiddleware(),
  authMiddleware(),
  permissionsMiddleware(),
];

/** El nonce de la CSP de este pedido, para marcar los scripts del documento, y el menú de la persona. */
export function loader({ context }: Route.LoaderArgs) {
  const member = context.get(teamMemberContext);
  return { nonce: context.get(nonceContext), menu: member ? menuFor(member) : [] };
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

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {loaderData.menu.length > 0 && <MainNav items={loaderData.menu} />}
      <Outlet />
    </>
  );
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Panel ensō' }];
}

const ERROR_MESSAGES: Record<number, { title: string; detail: string }> = {
  403: {
    title: 'No tienes acceso a esta página',
    detail: 'Si crees que deberías tenerlo, pídeselo a quien administra el panel.',
  },
  404: { title: 'No encontramos esa página', detail: 'Revisa la dirección o vuelve al inicio.' },
};
const GENERIC_ERROR = { title: 'Algo salió mal', detail: 'Vuelve a intentarlo. Si sigue pasando, avísale al equipo.' };

/** El error que ve la persona: sin detalles técnicos ni trazas (plan §3.3). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { title, detail } = (isRouteErrorResponse(error) && ERROR_MESSAGES[error.status]) || GENERIC_ERROR;
  return (
    <main>
      <h1>{title}</h1>
      <p>{detail}</p>
      <a href="/">Ir al inicio</a>
    </main>
  );
}
