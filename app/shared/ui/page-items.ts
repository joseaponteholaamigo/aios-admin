// Qué números muestra la paginación (spec «Paginación numerada», CA-6). Con pocas páginas, todas.
// Con más, siempre siete lugares, así la fila no cambia de ancho al moverse: la primera, la última,
// la actual con una a cada lado y «…» en cada hueco. Es la forma de GitHub y de las librerías de
// tablas (MUI, Ant Design).
export type PageItem = number | 'gap-start' | 'gap-end';

/** `1 … a b c … N`: siete lugares. */
const SLOTS = 7;

/** Los números seguidos cuando la actual está cerca de un extremo: `1 2 3 4 5 … N`. */
const RUN = SLOTS - 2;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function pageItems(current: number, pages: number): PageItem[] {
  if (pages <= SLOTS) return range(1, pages);
  if (current < RUN) return [...range(1, RUN), 'gap-end', pages];
  if (current > pages - RUN + 1) return [1, 'gap-start', ...range(pages - RUN + 1, pages)];
  return [1, 'gap-start', current - 1, current, current + 1, 'gap-end', pages];
}
