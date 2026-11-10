// Una fila de tabla que se abre con un clic en cualquier parte, no solo en su enlace (Empresas,
// Cuentas personales y Usuarios de clientes). El enlace de la fila sigue siendo el camino con el
// teclado y con el lector de pantalla: la fila no se vuelve un control, así la tabla sigue siendo
// una tabla. Qué clic la abre lo decide `opensRow`.
import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { opensRow } from './row-click';
import './linked-row.css';

export function LinkedRow({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate();
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    const { metaKey, ctrlKey, shiftKey, altKey } = event;
    const target = event.target instanceof Element ? event.target : null;
    if (opensRow({ metaKey, ctrlKey, shiftKey, altKey, target }, window.getSelection()?.toString() ?? '')) navigate(to);
  };
  return <tr className="linked-row" onClick={open}>{children}</tr>;
}
