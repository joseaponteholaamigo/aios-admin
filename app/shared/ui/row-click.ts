// Qué clic abre una fila de tabla (`linked-row.tsx`). Sin React ni navegador, para poder probarlo.

/** Lo que ya responde a un clic por su cuenta: un clic sobre él no es un clic sobre la fila. */
export const CONTROLS = 'a, button, input, select, textarea, label, summary';

/** Del evento, solo lo que decide: las teclas y sobre qué cayó. */
export type ClickEvent = {
  metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean;
  target: { closest?: (selector: string) => unknown } | null;
};

/**
 * ¿El clic abre la fila? No si cayó sobre un control (el enlace ya navega: la fila navegaría dos
 * veces), ni con una tecla (Ctrl o Cmd es «en otra pestaña», y eso lo hace el enlace), ni si quien
 * lo hizo estaba eligiendo texto (arrastrar sobre un correo para copiarlo no saca de la lista).
 *
 * El primer clic de un triple clic todavía no tiene texto elegido, así que abre la fila: para copiar
 * un correo de la lista, se arrastra sobre él.
 */
export function opensRow(event: ClickEvent, selectedText: string): boolean {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (event.target?.closest?.(CONTROLS)) return false;
  return selectedText === '';
}
