// La traducción de la casa de una cuenta entre el panel y el backend (`GET` y `POST /v1/admin/clientes/{id}/casa`,
// spec «Reanudar la casa de una cuenta», «Contrato de la API»): el pedido a sus nombres en español, y la casa de vuelta
// a los del panel. Los rechazos van con los demás, en `write-mapping.ts`.
import type { FrozenLot, HouseChange, HouseChangeResult, HousePause, HouseReview, PauseCause } from '../../domain/house';
import { ApiContractError, asArray, asRecord, str, strOrNull } from './api-reading';

/** La ruta del backend, la misma para ver y para cambiar. Sin el correo: va en el cuerpo. */
export const housePath = (companyId: string) => `/v1/admin/clientes/${encodeURIComponent(companyId)}/casa`;

const CAUSE_FROM_API = new Map<unknown, PauseCause>([['reembolso', 'refund'], ['disputa', 'dispute']]);

/** El motivo, solo si se escribió uno: sin él, el backend anota «desde el panel». */
const reasonToApi = (reason: string | null) => (reason ? { motivo: reason } : {});

/** El cuerpo del pedido. Quitar la pausa es de la cuenta: no lleva correo ni lote (el backend lo rechazaría). */
export function toBackendHouseChange(change: HouseChange) {
  if (change.action === 'lift-pause') return { accion: 'quitar-pausa', ...reasonToApi(change.reason) };
  return { accion: 'descongelar', correo: change.email, lote: change.lotId, ...reasonToApi(change.reason) };
}

/** Una cantidad de créditos. Sin ella, mostrar «0» diría que no queda nada congelado: rompe el contrato. */
function credits(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiContractError(`${what}: no es un número`);
  return value;
}

/** Un motivo que el panel no conoce no se inventa: la pausa queda sin él, y se muestra igual. */
function toPause(raw: unknown): HousePause {
  const p = asRecord(raw, 'la pausa de la casa');
  return { since: strOrNull(p.desde), cause: CAUSE_FROM_API.get(p.motivo) ?? null, stripeEvent: strOrNull(p.evento) };
}

function toFrozenLot(raw: unknown): FrozenLot {
  const l = asRecord(raw, 'un lote congelado');
  return {
    email: str(l.correo, 'un lote congelado: correo'),
    lotId: str(l.lote, 'un lote congelado: lote'),
    name: strOrNull(l.nombre),
    credits: credits(l.creditos, 'un lote congelado: creditos'),
    balance: credits(l.saldo, 'un lote congelado: saldo'),
    expiresAt: strOrNull(l.vence),
    frozenAt: strOrNull(l.congeladoEl),
    stripeEvent: strOrNull(l.evento),
  };
}

/**
 * La casa de la cuenta. `pausa` tiene que venir, aunque sea `null`: si faltara, decir «sin pausa» sería afirmar algo
 * que el backend no dijo, así que rompe el contrato y la tarjeta dice que no se pudo leer.
 */
export function toHouseReview(body: unknown): HouseReview {
  const b = asRecord(body, 'la casa de la cuenta');
  return {
    pause: b.pausa === null ? null : toPause(b.pausa),
    frozenLots: asArray(b.congelados, 'la casa de la cuenta: congelados').map(toFrozenLot),
  };
}

/** Lo que responde un cambio: la misma casa, ya cambiada, y si cambió algo. */
export function toHouseChangeResult(body: unknown): HouseChangeResult {
  return { house: toHouseReview(body), changed: asRecord(body, 'el cambio de la casa').cambio === true };
}
