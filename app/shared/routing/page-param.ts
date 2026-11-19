// La página de una lista en la dirección del panel: `?page=N`, y la primera no lo lleva (spec
// «Paginación numerada», CA-8 y CB-2).
export const PAGE_PARAM = 'page';

/** Un entero de 1 en adelante, por debajo del tope del backend (100 000): lo demás no se le pide. */
const PAGE_FORMAT = /^[1-9]\d{0,4}$/;

/** La página que pide la dirección. Lo que no es un número de página, incluido un `?cursor=` viejo, es la primera. */
export function pageFrom(params: URLSearchParams): number {
  const raw = params.get(PAGE_PARAM) ?? '';
  return PAGE_FORMAT.test(raw) ? Number(raw) : 1;
}

/** El parámetro de la página, para sumarlo a los de los filtros. */
export const pageParam = (page: number): Record<string, string> => (page > 1 ? { [PAGE_PARAM]: String(page) } : {});
