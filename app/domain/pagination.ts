// Una página de una lista: cuál es, cuántas hay y cuántas filas tiene la lista entera, con sus
// filtros (spec «Paginación numerada», CA-1).
export type PageInfo = { page: number; pages: number; total: number; perPage: number };

/** Lo que llegó sin datos de página (el backend de antes): todo en una sola página (CB-1). */
export const singlePage = (count: number): PageInfo => ({ page: 1, pages: 1, total: count, perPage: Math.max(count, 1) });

/**
 * La forma de un cursor de una lista por índice (el `siguiente` del backend, spec «Registro abierto», CA-24):
 * base64url y hasta 400 caracteres, lo mismo que el backend acepta. Otra cosa no salió de él y no se le pide.
 */
const CURSOR_FORMAT = /^[A-Za-z0-9_-]{1,400}$/;

export const isCursor = (value: unknown): value is string => typeof value === 'string' && CURSOR_FORMAT.test(value);

/** Las filas que muestra la página, contando desde 1: `{ from: 51, to: 100 }`. Sin filas, `null`. */
export function rowsShown({ page, total, perPage }: PageInfo): { from: number; to: number } | null {
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1;
  return { from, to: Math.min(page * perPage, total) };
}
