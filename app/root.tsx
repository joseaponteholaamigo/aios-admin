// El marco de todas las páginas: <html>, metadatos y scripts. Sin pantallas: cada una vive en su
// módulo (`app/modules/`), y el mapa de rutas está en `app/routes.ts`.
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from 'react-router';
import type { Route } from './+types/root';

export function Layout({ children }: { children: ReactNode }) {
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
        <ScrollRestoration />
        <Scripts />
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
  const titulo = isRouteErrorResponse(error) && error.status === 404 ? 'No encontramos esa página' : 'Algo salió mal';
  return (
    <main>
      <h1>{titulo}</h1>
      <p>Vuelve a intentarlo. Si sigue pasando, avísale al equipo.</p>
    </main>
  );
}
