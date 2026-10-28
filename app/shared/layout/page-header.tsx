// El encabezado de una pantalla, como en el panel viejo: título, una línea que dice para qué sirve
// y, a la derecha, sus acciones.
import type { ReactNode } from 'react';
import './page-header.css';

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="adm-head">
      <div>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="adm-actions">{actions}</div>}
    </div>
  );
}
