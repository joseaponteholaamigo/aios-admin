// La traducción de revocar y reactivar una cuenta entre el panel y el backend (`POST /v1/admin/clientes/{id}/estado`,
// spec «Revocar y reactivar una cuenta», «Contrato de la API»): el pedido a sus nombres en español, y la vista
// previa o lo guardado de vuelta a los del panel. Los rechazos van con los demás, en `write-mapping.ts`.
import type { AccountStatusAction, AccountStatusChange, AccountStatusResult } from '../../domain/account-status';
import { ApiContractError, asRecord, num, strOrNull } from './api-reading';

export const accountStatusPath = (companyId: string) => `/v1/admin/clientes/${encodeURIComponent(companyId)}/estado`;

const ACTION_TO_API: Record<AccountStatusAction, string> = { revoke: 'revocar', reactivate: 'reactivar' };
const ACTION_FROM_API = new Map<unknown, AccountStatusAction>([['revocar', 'revoke'], ['reactivar', 'reactivate']]);

/**
 * El cuerpo del pedido. La vista previa va sin motivo ni confirmación: se pide al abrir el diálogo, antes de escribir
 * nada. Guardar lleva el motivo y, solo al revocar, `confirmo` con lo escrito, aunque esté vacío: así el backend
 * responde `confirmacion` y no un pedido a medias.
 */
export function toBackendStatusChange({ action, reason, confirmation, previewOnly }: AccountStatusChange) {
  return {
    accion: ACTION_TO_API[action],
    ...(reason ? { motivo: reason } : {}),
    ...(previewOnly ? { soloVer: true } : action === 'revoke' ? { confirmo: confirmation ?? '' } : {}),
  };
}

/** Lo que responde un cambio de estado: la vista previa, o lo que quedó guardado. Una acción que no es de las dos rompe el contrato. */
export function toAccountStatusResult(body: unknown): AccountStatusResult {
  const b = asRecord(body, 'el cambio de estado');
  const action = ACTION_FROM_API.get(b.accion);
  if (!action) throw new ApiContractError(`el cambio de estado trae una acción que el panel no conoce: ${String(b.accion)}`);
  const status = asRecord(b.estado, 'el cambio de estado: estado');
  return {
    action,
    previewOnly: b.soloVer === true,
    changed: b.cambio === true,
    status: { before: strOrNull(status.antes), after: strOrNull(status.despues) },
    people: num(b.personas),
  };
}
