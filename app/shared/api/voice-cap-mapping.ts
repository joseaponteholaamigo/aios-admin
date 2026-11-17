// La traducción del tope de la voz entre el panel y el backend (`GET` y `PUT /v1/admin/voz`, CA-33 de la
// spec «Registro abierto» de aios-tower): sus nombres en español, a los del panel y de vuelta. El resto
// del panel no ve un nombre del backend.
import type { VoiceCapChange, VoiceCapChanged, VoiceCapException, VoiceCaps } from '../../domain/voice-cap';
import { ApiContractError, asArray, asRecord, numOrNull, str, strOrNull } from './api-reading';

/** La ruta del tope de la voz, la misma para leer y para cambiar. La cuenta de una excepción va en el cuerpo, nunca aquí. */
export const VOICE_CAP_PATH = '/v1/admin/voz';

/** Un tope en dólares. Uno que no es un número rompe el contrato: nunca se muestra como 0. */
function dollars(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiContractError(`${what}: no es un número`);
  return value;
}

function toException(raw: unknown): VoiceCapException {
  const e = asRecord(raw, 'la excepción');
  return {
    accountId: str(e.tenantId, 'la excepción.tenantId'), accountName: strOrNull(e.nombre), usd: dollars(e.topeUsd, 'la excepción.topeUsd'),
    changedBy: strOrNull(e.cambiadoPor), changedAt: strOrNull(e.cambiadoEl),
  };
}

/** Lo que muestra la pantalla de la voz (`GET /v1/admin/voz`). */
export function toVoiceCaps(body: unknown): VoiceCaps {
  const b = asRecord(body, 'el tope de la voz');
  const g = asRecord(b.general, 'el tope general');
  return {
    general: { usd: dollars(g.topeUsd, 'el tope general.topeUsd'), isDefault: g.porOmision === true, changedBy: strOrNull(g.cambiadoPor), changedAt: strOrNull(g.cambiadoEl) },
    maxUsd: dollars(b.maximoUsd, 'el tope de la voz.maximoUsd'),
    exceptions: asArray(b.excepciones, 'las excepciones').map(toException),
    // Sin el dato, se avisa del filtro: callar que faltan cuentas es peor que avisar de más.
    onlySome: b.soloAlgunas !== false,
  };
}

/**
 * El cuerpo de `PUT /v1/admin/voz`. El tope viaja como número (el backend rechaza `"8"`), y quitar una
 * excepción manda `topeUsd: null` explícito: sin él, el backend lo rechaza.
 */
export function toBackendVoiceCapChange(change: VoiceCapChange) {
  if (change.target === 'general') return { topeUsd: change.usd, motivo: change.reason };
  return { tenantId: change.accountId, topeUsd: change.usd, motivo: change.reason };
}

/** Lo que responde un cambio: `{ general: { antes, despues } }` o `{ tenantId, topeUsd: { antes, despues } }`. */
export function toVoiceCapChanged(body: unknown): VoiceCapChanged {
  const b = asRecord(body, 'el cambio del tope de la voz');
  const change = asRecord(b.general ?? b.topeUsd, 'el cambio del tope de la voz: el antes y el después');
  return { before: numOrNull(change.antes), after: numOrNull(change.despues) };
}
