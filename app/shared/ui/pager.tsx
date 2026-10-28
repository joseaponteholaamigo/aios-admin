// La paginación de una lista: cuántas se ven, volver a la primera y la siguiente. El cursor viaja en
// la dirección, así que cada página es un enlace y no necesita JavaScript.
import { Link } from 'react-router';
import './pager.css';

export function Pager({ shown, firstHref, nextHref }: { shown: string; firstHref: string | null; nextHref: string | null }) {
  return (
    <nav className="pag" aria-label="Páginas">
      <span>{shown}</span>
      <span className="btns">
        {firstHref && <Link className="btn sm" to={firstHref}>Primera página</Link>}
        {nextHref && <Link className="btn sm soft" to={nextHref}>Siguiente</Link>}
      </span>
    </nav>
  );
}
