// Lo que dice la pestaña de cuentas personales, que sale del índice de cuentas (spec «Registro abierto» de
// aios-tower, CA-23 y CA-24): de dónde salió cada cuenta, sus números por origen, la página, la lista vacía y
// el aviso de un enlace de página que ya no sirve. Puras.
import type { AccountOrigin } from '../../domain/companies';
import { countOf } from './company-labels';

/** Cómo se nombra cada origen. */
export const ORIGIN_LABELS: Record<AccountOrigin, string> = {
  signup: 'Registro', code: 'Código', purchase: 'Compra en la web', webinar: 'Webinar', team: 'Alta del equipo',
};

/** De dónde salió una cuenta personal: «Sin dato» si el backend no dijo uno que el panel conozca. */
export const originLabel = (origin: AccountOrigin | null) => (origin ? ORIGIN_LABELS[origin] : 'Sin dato');

/** Lo que aclaran los números con el filtro de empresas visibles puesto: no son todas las cuentas. */
export const ONLY_SOME_COUNTS_NOTE = 'Estos números, y los de las pestañas, cuentan solo las cuentas visibles para el panel.';

/** «50 cuentas personales en esta página, de la más nueva a la más vieja». */
export function pageSummary(shown: number): string {
  if (shown === 0) return 'Ninguna cuenta en esta página';
  return `${countOf('personal', shown)} en esta página, de la más nueva a la más vieja`;
}

/**
 * Qué dice la lista cuando la página no trae ninguna cuenta.
 *
 * La lista sale del índice de cuentas, y las cuentas que existían antes de él entran con un relleno que se
 * corre aparte (CA-44): un índice vacío no prueba que no haya cuentas personales, así que la pantalla no lo
 * afirma. Con el filtro de empresas visibles la lista no sale del índice sino de esas cuentas, y ahí sí es cierto.
 */
export function emptyPersonalAccountsMessage({ onlySome, after }: { onlySome: boolean; after: string | null }): string {
  if (after !== null) return 'Esta página no trae ninguna cuenta.';
  if (onlySome) return 'Ninguna de las cuentas visibles para el panel es una cuenta personal.';
  return 'La lista no trae ninguna cuenta personal, y eso no prueba que no haya: sale de un índice, y las cuentas que ya '
    + 'existían entran a él cuando se corre su relleno (npm run rellenar-indice-de-cuentas). La búsqueda por correo sí las encuentra.';
}

/** El aviso de un cursor que no sirvió, en la dirección de la primera página. Nunca lleva el cursor. */
const NOTICE_PARAM = 'aviso';
const CURSOR_RESET = 'cursor';

/** A dónde va un enlace de página que el backend no entiende: a la primera página, con el aviso. */
export const cursorResetHref = () => `/companies?${new URLSearchParams({ kind: 'personal', [NOTICE_PARAM]: CURSOR_RESET })}`;

/** Qué dice la pestaña al volver a la primera página por un enlace que no sirvió, o `null`. */
export function cursorResetNotice(params: URLSearchParams): string | null {
  return params.get(NOTICE_PARAM) === CURSOR_RESET ? 'Ese enlace a una página de la lista ya no sirve: te mostramos la primera.' : null;
}
