// Borrar una cuenta entera desde el panel (spec «Borrar cuentas y destrabar personas», CA-23 a
// CA-27). Solo el superadministrador, con MFA reciente; el backend lo vuelve a revisar.
import type { SeatStatus } from './client-users';
import type { AccountKind, CompanyPlan } from './companies';

/** Dónde vive lo de una cuenta, con el nombre del panel. `other` es un sitio que el panel no conoce todavía: se muestra igual. */
export const DELETION_SITES = [
  'record', 'seats', 'events', 'governance', 'publications', 'capabilities', 'sharedWork', 'access',
  'invitationCap', 'credentials', 'emailIndex', 'stripe', 'panelSignups', 'pendingMoves', 'packages', 'logins', 'audit',
] as const;
export type DeletionSiteKey = (typeof DELETION_SITES)[number];
export type DeletionSite = { key: DeletionSiteKey | 'other'; raw: string };

export type DeletionPerson = { email: string; isAdmin: boolean; status: SeatStatus };

/**
 * Lo que se borraría (CA-13). `name` y `kind` faltan en un borrado que quedó a medias y ya se llevó
 * la ficha (`pending`). `charging`: la suscripción de Stripe sigue cobrando y no se puede borrar (CA-26).
 */
export type DeletionPreview = {
  company: { id: string; name: string | null; kind: AccountKind | null; plan: CompanyPlan | null };
  people: DeletionPerson[];
  sites: Array<{ site: DeletionSite; rows: number }>;
  packages: number;
  charging: boolean;
  pending: boolean;
};

/** Un borrado que empezó y no terminó (CA-22). */
export type PendingDeletion = { id: string; startedAt: string | null; requestedBy: string | null };

/** Lo que manda el formulario: el id escrito a mano y, si se quiere, el motivo. */
export type AccountDeletion = { confirmation: string; reason: string | null };

/** Lo que quedó: de qué tipo era la cuenta, para volver a su pestaña de Empresas (CA-25). */
export type DeletedAccount = { kind: AccountKind | null };
