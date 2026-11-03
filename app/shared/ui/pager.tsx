// La paginación de una lista (spec «Paginación numerada», CA-5 a CA-9): «Mostrando 51–100 de 377
// cuentas personales», «Anterior», los números y «Siguiente». Cada página es un enlace con su número
// en la dirección, así que funciona sin JavaScript y se puede compartir. «Anterior» y «Siguiente»
// desactivados son enlaces sin destino: `aria-disabled` en un `span` el lector de pantalla no lo dice.
import { Link } from 'react-router';
import { rowsShown, type PageInfo } from '../../domain/pagination';
import { pageItems } from './page-items';
import './pager.css';

type PagerProps = {
  page: PageInfo;
  /** Lo que se cuenta, con su número: «377 cuentas personales». */
  of: string;
  hrefOf: (page: number) => string;
};

export function Pager({ page, of, hrefOf }: PagerProps) {
  const shown = rowsShown(page);
  // Sin filas no hay nada que paginar: el mensaje de la lista vacía ya lo dice (CA-9).
  if (!shown) return null;
  const { page: current, pages } = page;
  return (
    <nav className="pag" aria-label="Páginas">
      <span>Mostrando {shown.from}–{shown.to} de {of}</span>
      {pages > 1 && (
        <span className="btns">
          {current > 1
            ? <Link className="pag-step" to={hrefOf(current - 1)} rel="prev">Anterior</Link>
            : <a className="pag-step" role="link" aria-disabled="true">Anterior</a>}
          {pageItems(current, pages).map((item) => {
            if (typeof item !== 'number') return <span key={item} className="pag-gap" aria-hidden="true">…</span>;
            if (item === current) return <span key={item} className="pag-num on" aria-current="page">{item}</span>;
            return <Link key={item} className="pag-num" to={hrefOf(item)} aria-label={`Página ${item}`}>{item}</Link>;
          })}
          {current < pages
            ? <Link className="pag-step" to={hrefOf(current + 1)} rel="next">Siguiente</Link>
            : <a className="pag-step" role="link" aria-disabled="true">Siguiente</a>}
        </span>
      )}
    </nav>
  );
}
