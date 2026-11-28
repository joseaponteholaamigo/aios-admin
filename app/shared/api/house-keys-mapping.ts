// La traducción de las claves de la casa entre el panel y el backend (`GET /v1/admin/casa`, `GET` y
// `PUT /v1/admin/casa/:servicio`; spec «Compartir referentes» de aios-tower, §6): sus nombres en español,
// a los del panel y de vuelta. El resto del panel no ve un nombre del backend.
//
// ⚠️ LA CLAVE VIAJA EN UN SOLO SENTIDO. Sale del formulario hacia el backend en `toBackendHouseKeyChange`,
// y nada de lo que se lee aquí la trae de vuelta: el backend manda solo sus últimos 4 caracteres, y si
// mandara más, aquí se recortan antes de llegar a una pantalla.
import {
  HISTORY_SIZE, isHouseKeyService,
  type HouseKeyChangeRequest, type HouseKeyDetail, type HouseKeyHistoryAction, type HouseKeyHistoryEntry, type HouseKeyService, type HouseKeyStatus,
} from '../../domain/house-keys';
import { ApiContractError, asArray, asRecord, numOrNull, str, strOrNull, type Log } from './api-reading';

/** La lista de servicios. La página de cada uno lleva el servicio en la ruta (D18). */
export const HOUSE_KEYS_PATH = '/v1/admin/casa';
export const houseKeyPath = (service: HouseKeyService) => `${HOUSE_KEYS_PATH}/${encodeURIComponent(service)}`;

/** Cada acción del historial, como la guarda la auditoría del backend. */
const HISTORY_ACTION_FROM_API: Record<string, HouseKeyHistoryAction> = {
  poner: 'set', cambiar: 'change', quitar: 'remove', encender: 'enable', apagar: 'disable',
};

function bool(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') throw new ApiContractError(`${what}: no es sí o no`);
  return value;
}

/**
 * Los últimos 4 caracteres. Si el backend mandara más, se quedan solo los 4 últimos y se avisa en el log (sin
 * el valor): la pantalla nunca muestra más de 4 (D21). Menos de 4, o nada, es «no se sabe».
 */
function lastFourOf(value: unknown, log: Log): string | null {
  if (typeof value !== 'string' || value.length < 4) return null;
  if (value.length > 4) log('La clave de la casa trae más de 4 caracteres en `ultimos4`: se muestran solo los últimos 4');
  return value.slice(-4);
}

/** El saldo de la casa: `null` si `Casa` no respondió (`saldo: null`) o si no trae un número. */
function balanceOf(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return numOrNull((value as Record<string, unknown>).creditos);
}

/** Un servicio de la lista o de su página. `null` si es uno que el panel no conoce: se ignora y queda en el log. */
function toStatus(raw: unknown, log: Log): HouseKeyStatus | null {
  const s = asRecord(raw, 'el servicio');
  const service = str(s.servicio, 'el servicio.servicio');
  if (!isHouseKeyService(service)) {
    log(`Claves de la casa: el backend trae un servicio que el panel no conoce y se ignora: ${service}`);
    return null;
  }
  const key = asRecord(s.clave, 'el servicio.clave');
  // Sin `cambio` no hay nada que decir del último cambio: no rompe la página.
  const change = key.cambio && typeof key.cambio === 'object' ? (key.cambio as Record<string, unknown>) : {};
  const keySet = bool(key.puesta, 'el servicio.clave.puesta');
  return {
    service,
    keySet,
    // Sin clave no hay en qué termina: unos últimos 4 viejos dirían que hay una puesta.
    lastFour: keySet ? lastFourOf(key.ultimos4, log) : null,
    lastChange: { changedAt: strOrNull(change.el), changedBy: strOrNull(change.por), reason: strOrNull(change.motivo) },
    enabled: bool(s.encendido, 'el servicio.encendido'),
    balance: balanceOf(s.saldo),
  };
}

/** La lista de «Claves de la casa» (`GET /v1/admin/casa`). */
export function toHouseKeys(body: unknown, log: Log): HouseKeyStatus[] {
  const b = asRecord(body, 'las claves de la casa');
  return asArray(b.servicios, 'las claves de la casa.servicios').flatMap((raw) => toStatus(raw, log) ?? []);
}

function toHistoryEntry(raw: unknown): HouseKeyHistoryEntry {
  const e = asRecord(raw, 'una entrada del historial');
  const action = strOrNull(e.accion);
  return { at: strOrNull(e.el), by: strOrNull(e.por), action: action ? HISTORY_ACTION_FROM_API[action] ?? null : null, reason: strOrNull(e.motivo) };
}

/**
 * La página de un servicio (`GET /v1/admin/casa/:servicio`): «lo mismo que la lista, más el historial». Se
 * acepta el servicio suelto o dentro de `servicios`, como en la lista: la spec no fija cuál de los dos.
 */
export function toHouseKeyDetail(body: unknown, service: HouseKeyService, log: Log): HouseKeyDetail {
  const b = asRecord(body, 'la clave de la casa');
  const raw = Array.isArray(b.servicios)
    ? b.servicios.find((s) => s && typeof s === 'object' && (s as Record<string, unknown>).servicio === service)
    : b;
  if (!raw) throw new ApiContractError(`la clave de la casa: no trae ${service}`);
  const status = toStatus(raw, log);
  if (!status || status.service !== service) throw new ApiContractError(`la clave de la casa: trae otro servicio en lugar de ${service}`);
  const history = Array.isArray(b.historial) ? b.historial : (raw as Record<string, unknown>).historial;
  return { ...status, history: asArray(history ?? [], 'el historial').slice(0, HISTORY_SIZE).map(toHistoryEntry) };
}

/** El cuerpo de `PUT /v1/admin/casa/:servicio`. La clave va aquí y en ningún otro lado. */
export function toBackendHouseKeyChange(change: HouseKeyChangeRequest) {
  switch (change.action) {
    case 'key': return { accion: 'clave', clave: change.key, motivo: change.reason, encender: change.enable };
    case 'remove': return { accion: 'quitar', motivo: change.reason };
    case 'switch': return { accion: 'interruptor', encendido: change.enabled, motivo: change.reason };
  }
}
