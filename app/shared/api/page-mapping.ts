// La traducción de `paginacion` (`{ pagina, paginas, total, porPagina }`), que traen las tres listas
// de la API de admin, al idioma del panel (spec «Paginación numerada», CA-1 y CB-1).
import { singlePage, type PageInfo } from '../../domain/pagination';
import { ApiContractError } from './api-reading';

const isWhole = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/**
 * La página de una lista. Sin `paginacion` (el backend todavía no se desplegó), todo lo que llegó es
 * una sola página. Con una que no cuadra (la página después de la última, un total negativo), el
 * contrato se rompió.
 */
export function toPageInfo(raw: unknown, rowCount: number): PageInfo {
  if (raw === undefined) return singlePage(rowCount);
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const { pagina, paginas, total, porPagina } = p;
  if (!isWhole(pagina) || !isWhole(paginas) || !isWhole(total) || !isWhole(porPagina) || pagina < 1 || pagina > paginas || porPagina < 1) {
    throw new ApiContractError('paginacion: no tiene la forma { pagina, paginas, total, porPagina }');
  }
  return { page: pagina, pages: paginas, total, perPage: porPagina };
}
