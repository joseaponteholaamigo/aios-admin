// La paginación de una lista (spec «Paginación numerada», CA-5 a CA-9): «Mostrando 51–100 de 377
// cuentas personales», «Anterior», los números y «Siguiente». Cada página es un enlace con su número
// en la dirección, así que funciona sin JavaScript y se puede compartir. «Anterior» y «Siguiente»
// desactivados son enlaces sin destino: `aria-disabled` en un `span` el lector de pantalla no lo dice.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { rowsShown, type PageInfo } from '../../domain/pagination';
import { pageItems } from './page-items';
import './pager.css';

type PagerProps = {
  page: PageInfo;
  /** Lo que se cuenta, con su número: «377 cuentas personales». */
  of: string;
} & (
  | { hrefOf: (page: number) => string; submitName?: never }
  /**
   * Una lista que se pide por POST (la bitácora de créditos: su filtro puede llevar un correo, y un
   * correo no va en la dirección). Cada página es un botón que manda el formulario que la contiene
   * con `submitName` igual a su número.
   */
  | { submitName: string; hrefOf?: never }
);

/** Un paso de la paginación: un enlace a su página, o un botón del formulario que la pide. */
function Step({ to, className, rel, label, children, hrefOf, submitName }: {
  to: number; className: string; rel?: string; label?: string; children: ReactNode;
  hrefOf?: (page: number) => string; submitName?: string;
}) {
  if (submitName) return <button type="submit" className={className} name={submitName} value={to} aria-label={label}>{children}</button>;
  return <Link className={className} to={hrefOf!(to)} rel={rel} aria-label={label}>{children}</Link>;
}

export function Pager({ page, of, hrefOf, submitName }: PagerProps) {
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
            ? <Step to={current - 1} className="pag-step" rel="prev" hrefOf={hrefOf} submitName={submitName}>Anterior</Step>
            : <a className="pag-step" role="link" aria-disabled="true">Anterior</a>}
          {pageItems(current, pages).map((item) => {
            if (typeof item !== 'number') return <span key={item} className="pag-gap" aria-hidden="true">…</span>;
            if (item === current) return <span key={item} className="pag-num on" aria-current="page">{item}</span>;
            return <Step key={item} to={item} className="pag-num" label={`Página ${item}`} hrefOf={hrefOf} submitName={submitName}>{item}</Step>;
          })}
          {current < pages
            ? <Step to={current + 1} className="pag-step" rel="next" hrefOf={hrefOf} submitName={submitName}>Siguiente</Step>
            : <a className="pag-step" role="link" aria-disabled="true">Siguiente</a>}
        </span>
      )}
    </nav>
  );
}
