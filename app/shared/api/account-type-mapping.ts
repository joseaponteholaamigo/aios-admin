// La traducción de pasar una empresa a cuenta personal, y al revés, entre el panel y el backend
// (`POST /v1/admin/clientes/{id}/tipo`, spec «Pasar una empresa a cuenta personal, y al revés», «Contrato de la API»):
// el pedido a sus nombres en español, y la vista previa o lo guardado de vuelta a los del panel. Los rechazos van con
// los demás, en `write-mapping.ts`.
import type { AccountTypeChange, AccountTypeResult } from '../../domain/account-type';
import type { AccountKind } from '../../domain/companies';
import { ApiContractError, asRecord, strOrNull } from './api-reading';
import { ACCOUNT_KIND_TO_API } from './client-users-mapping';

export const accountTypePath = (companyId: string) => `/v1/admin/clientes/${encodeURIComponent(companyId)}/tipo`;

const KIND_FROM_API = new Map<unknown, AccountKind>(Object.entries(ACCOUNT_KIND_TO_API).map(([kind, api]) => [api, kind as AccountKind]));

/** Un tipo que no es uno de los dos rompe el contrato: mostrarlo como el otro diría lo contrario de lo que pasa. */
function toKind(value: unknown, what: string): AccountKind {
  const kind = KIND_FROM_API.get(value);
  if (!kind) throw new ApiContractError(`${what}: un tipo de cuenta que el panel no conoce: ${String(value)}`);
  return kind;
}

/**
 * El cuerpo del pedido. La vista previa va con `soloVer` y sin motivo: se pide al abrir el diálogo, antes de escribir
 * nada. Guardar lleva el motivo solo si se escribió uno: sin él, el backend anota «desde el panel».
 */
export function toBackendTypeChange({ kind, reason, previewOnly }: AccountTypeChange) {
  return { tipo: ACCOUNT_KIND_TO_API[kind], ...(reason ? { motivo: reason } : {}), ...(previewOnly ? { soloVer: true } : {}) };
}

/** Lo que responde un cambio de tipo: la vista previa, o lo que quedó guardado. */
export function toAccountTypeResult(body: unknown): AccountTypeResult {
  const b = asRecord(body, 'el cambio de tipo');
  const kind = asRecord(b.tipo, 'el cambio de tipo: tipo');
  return {
    previewOnly: b.soloVer === true,
    changed: b.cambio === true,
    kind: { before: toKind(kind.antes, 'el cambio de tipo: antes'), after: toKind(kind.despues, 'el cambio de tipo: después') },
    person: strOrNull(b.persona),
  };
}
