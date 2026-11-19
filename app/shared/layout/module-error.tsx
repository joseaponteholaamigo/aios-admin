// Lo que ve la persona cuando una pantalla no pudo cargar (CA-25 de M2a), dentro del marco: cada
// ruta de módulo lo usa como su `ErrorBoundary`. Sin detalles técnicos ni trazas.
import { isRouteErrorResponse, useLocation } from 'react-router';
import { Icon } from '../icons/icon';

const MESSAGES: Record<number, { title: string; detail: string; retry?: boolean }> = {
  400: { title: 'Ese enlace ya no sirve', detail: 'La lista cambió desde que lo abriste. Vuelve a la primera página.' },
  403: { title: 'No tienes acceso a esto', detail: 'Si crees que deberías tenerlo, pídeselo a quien administra el panel.' },
  404: { title: 'Esa empresa no existe o no está disponible', detail: 'Revisa la dirección, o vuelve a la lista.' },
  503: { title: 'El backend no respondió', detail: 'Tu sesión sigue abierta. Vuelve a intentarlo en un momento.', retry: true },
};
const GENERIC = { title: 'Algo salió mal', detail: 'Vuelve a intentarlo. Si sigue pasando, avísale al equipo.', retry: true };

/** Adónde lleva el botón: la misma página (con su búsqueda) para reintentar; la lista; o el inicio si falta permiso. */
function hrefFor(status: number | null, retry: boolean | undefined, pathname: string, search: string) {
  if (retry) return `${pathname}${search}`;
  if (status === 403) return '/';
  return pathname.split('/').slice(0, 2).join('/') || '/';
}

export function ModuleError({ error }: { error: unknown }) {
  const { pathname, search } = useLocation();
  const status = isRouteErrorResponse(error) ? error.status : null;
  const { title, detail, retry } = (status !== null && MESSAGES[status]) || GENERIC;
  return (
    <section className="card pad" role="alert">
      <span className="eyebrow">No se pudo cargar</span>
      <h1>{title}</h1>
      <p className="muted">{detail}</p>
      <p>
        {/* Un enlace de documento y no de React Router: vuelve a pedir la página entera. */}
        <a className="btn" href={hrefFor(status, retry, pathname, search)}>
          <Icon name={retry ? 'arrow' : 'chev'} />
          {retry ? 'Volver a intentar' : status === 403 ? 'Ir al inicio' : 'Volver a la lista'}
        </a>
      </p>
    </section>
  );
}
