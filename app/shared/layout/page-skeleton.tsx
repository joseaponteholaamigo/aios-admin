// El esqueleto de una pantalla mientras carga: el encabezado y una tarjeta con filas, con la forma
// de las pantallas del panel. Dice «Cargando…» a quien usa un lector de pantalla.
import './page-skeleton.css';

const ROWS = 6;
/** Columnas por fila. Sus anchos están en el CSS: la CSP no deja poner estilos en línea. */
const COLUMNS = 5;

export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status">
      <span className="page-skeleton__label">Cargando…</span>
      <div className="page-skeleton__head" aria-hidden="true">
        <span className="page-skeleton__bar page-skeleton__bar--crumbs" />
        <span className="page-skeleton__bar page-skeleton__bar--title" />
        <span className="page-skeleton__bar page-skeleton__bar--lead" />
      </div>
      <div className="card page-skeleton__card" aria-hidden="true">
        <span className="page-skeleton__bar page-skeleton__bar--card-title" />
        {Array.from({ length: ROWS }, (_, row) => (
          <div className="page-skeleton__row" key={row}>
            {Array.from({ length: COLUMNS }, (_, column) => <span className="page-skeleton__bar" key={column} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
