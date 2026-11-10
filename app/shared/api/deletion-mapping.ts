// La traducción del borrado de cuentas entre el panel y el backend (`GET/POST /v1/admin/clientes/{id}/borrado`
// y `GET /v1/admin/borrados-pendientes`): los nombres de los sitios, las personas y los pendientes.
import type { AccountDeletion, DeletedAccount, DeletionPreview, DeletionSite, DeletionSiteKey, PendingDeletion } from '../../domain/account-deletion';
import { asRecord, num, str, strOrNull, type Log } from './api-reading';
import { toAccountKind, toSeatStatus } from './client-users-mapping';

/** Los sitios de `sitiosDeUnCliente` (`src/lib/borrado.js` del backend), más los paquetes, los logins y la auditoría del borrado. */
const SITE_FROM_API: Record<string, DeletionSiteKey> = {
  ficha: 'record', asientos: 'seats', eventos: 'events', gobierno: 'governance', publicaciones: 'publications',
  capacidades: 'capabilities', trabajo: 'sharedWork', acceso: 'access', invitaciones: 'invitationCap',
  credenciales: 'credentials', correos: 'emailIndex', stripe: 'stripe', altas: 'panelSignups', movidas: 'pendingMoves',
  paquetes: 'packages', identidades: 'logins', auditoria: 'audit',
};

/** Un sitio que el panel no conoce se muestra con su nombre: si se escondiera, la vista previa diría que se borra menos. */
export const toDeletionSite = (raw: string): DeletionSite => ({ key: SITE_FROM_API[raw] ?? 'other', raw });

const toPlan = (value: unknown) => (value === 'personalizado' ? 'custom' : strOrNull(value));

export function toDeletionPreview(body: unknown, log: Log): DeletionPreview {
  const b = asRecord(body, 'la vista previa del borrado');
  const c = asRecord(b.cuenta, 'la cuenta a borrar');
  const sites = asRecord(b.sitios ?? {}, 'los sitios');
  const unknown = Object.keys(sites).filter((k) => !(k in SITE_FROM_API));
  if (unknown.length) log(`La vista previa del borrado trae sitios que el panel no conoce: ${unknown.join(', ')}`);
  return {
    company: { id: str(c.id, 'cuenta.id'), name: strOrNull(c.nombre), kind: c.tipo == null ? null : toAccountKind(c.tipo), plan: toPlan(c.plan) },
    people: (Array.isArray(b.personas) ? b.personas : []).map((raw) => {
      const p = asRecord(raw, 'una persona');
      return { email: str(p.correo, 'persona.correo'), isAdmin: p.admin === true, status: toSeatStatus(p.estado) };
    }),
    sites: Object.entries(sites).map(([raw, rows]) => ({ site: toDeletionSite(raw), rows: num(rows) })),
    packages: num(b.paquetes),
    charging: b.cobra === true,
    pending: b.pendiente === true,
  };
}

export function toPendingDeletions(body: unknown): PendingDeletion[] {
  const b = asRecord(body, 'los borrados pendientes');
  return (Array.isArray(b.pendientes) ? b.pendientes : []).map((raw) => {
    const p = asRecord(raw, 'un borrado pendiente');
    return { id: str(p.id, 'pendiente.id'), startedAt: strOrNull(p.empezoEl), requestedBy: strOrNull(p.pedidoPor) };
  });
}

/** El cuerpo de `POST …/borrado`. Sin motivo, no viaja: el backend pone el suyo. */
export const toBackendDeletion = ({ confirmation, reason }: AccountDeletion) => ({ confirmo: confirmation, ...(reason ? { motivo: reason } : {}) });

export function toDeletedAccount(body: unknown): DeletedAccount {
  const b = asRecord(body, 'el borrado');
  return { kind: b.tipo == null ? null : toAccountKind(b.tipo) };
}
