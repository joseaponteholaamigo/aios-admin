// Lo que mandan los diálogos de «Quitar la pausa» y «Descongelar» (spec «Reanudar la casa de una cuenta», CA-13 y
// CA-14) y lo que les responde su ruta. Puro: lo prueba `tests/house-review.test.ts`. Si el lote es de esa persona en
// esa cuenta, y si está congelado, lo juzga el backend.
import type { WriteRejection } from '../../domain/account-creation';
import { isHouseAction, type HouseChange } from '../../domain/house';

/** La ruta de los dos diálogos: solo responde a un POST (`route-table.ts`). El correo va en el cuerpo, nunca aquí. */
export const houseHref = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/house`;

/**
 * Los campos. La acción no va en un campo `action`: un `<input name="action">` tapa la propiedad `form.action` del
 * formulario, que dice a dónde se manda.
 */
export const HOUSE_FIELDS = { change: 'change', email: 'email', lot: 'lot', reason: 'reason' } as const;

/** El motivo más largo que acepta el backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;

/** Por qué no se hizo: un rechazo del backend, o un motivo de más. Lo guardado no vuelve aquí: vuelve a la ficha. */
export type HouseAnswer = { ok: false; rejection: WriteRejection | null; errors: { reason?: string } };

const UNREADABLE: HouseAnswer = { ok: false, rejection: { code: 'invalid', message: 'el pedido no se entiende' }, errors: {} };

/**
 * El pedido (`{ change }`), o lo que vuelve al diálogo sin llegar a la API (`{ answer }`). El motivo es opcional
 * (decisión 3): vacío, no viaja. Descongelar sin el correo o sin el lote no se entiende.
 */
export function readHouseChange(form: FormData): { change: HouseChange } | { answer: HouseAnswer } {
  const action = form.get(HOUSE_FIELDS.change);
  if (!isHouseAction(action)) return { answer: UNREADABLE };
  const reason = String(form.get(HOUSE_FIELDS.reason) ?? '').trim();
  if (reason.length > REASON_MAX) return { answer: { ok: false, rejection: null, errors: { reason: `El motivo va hasta ${REASON_MAX} caracteres.` } } };
  if (action === 'lift-pause') return { change: { action, reason: reason || null } };
  const email = String(form.get(HOUSE_FIELDS.email) ?? '').trim();
  const lotId = String(form.get(HOUSE_FIELDS.lot) ?? '').trim();
  if (!email.includes('@') || !lotId) return { answer: UNREADABLE };
  return { change: { action, email, lotId, reason: reason || null } };
}
