// El encabezado de una pantalla, como en el panel viejo: las migas, el título, una línea que dice
// para qué sirve y, a la derecha, sus acciones.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import './page-header.css';

export type Crumb = { label: string; to?: string };

type Props = { title: string; lead?: ReactNode; actions?: ReactNode; crumbs?: Crumb[] };

export function PageHeader({ title, lead, actions, crumbs = [] }: Props) {
  return (
    <>
      {crumbs.length > 0 && (
        <nav className="adm-crumbs" aria-label="Dónde estás">
          {crumbs.map((crumb, i) => (
            <span key={crumb.label}>
              {i > 0 && <span aria-hidden="true">› </span>}
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
            </span>
          ))}
        </nav>
      )}
      <div className="adm-head">
        <div>
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
        {actions && <div className="adm-actions">{actions}</div>}
      </div>
    </>
  );
}
