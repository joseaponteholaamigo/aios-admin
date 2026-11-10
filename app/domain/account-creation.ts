// Crear una cuenta e invitar a una persona desde el panel (spec «Crear empresas e invitar personas»,
// M2b): lo que se pide y por qué el backend puede negarse. Los nombres del backend se traducen en
// `app/shared/api/write-mapping.ts`: aquí no aparece ninguno.
import type { AccountKind, Company } from './companies';
import type { DeletionSite } from './account-deletion';
import type { SeatStatus } from './client-users';

/** Los planes que se eligen al crear: Pro y Team se compran en la web (decisión 2). */
export const CREATION_PLANS = ['custom', 'free'] as const;
export type CreationPlan = (typeof CREATION_PLANS)[number];

/** El contenido base de un Personalizado: todo, el de Free o nada. */
export const CONTENT_LEVELS = ['all', 'free', 'none'] as const;
export type ContentLevel = (typeof CONTENT_LEVELS)[number];

/** Los recursos con cupo, en el orden en que se muestran. */
export const QUOTA_RESOURCES = ['radar', 'projects', 'skills', 'chains'] as const;
export type QuotaResource = (typeof QUOTA_RESOURCES)[number];

/** Un cupo por recurso: un número, o `null` para «sin tope». Un recurso que no está, hereda el del plan. */
export type Quotas = Partial<Record<QuotaResource, number | null>>;

export type PlanConditions = {
  content: ContentLevel;
  seats: number;
  team: boolean;
  schedules: boolean;
  /** `AAAA-MM-DD`, o `null` sin fecha de fin. */
  endsOn: string | null;
  quotas: Quotas;
};

export type NewAccount = {
  name: string;
  kind: AccountKind;
  plan: CreationPlan;
  /** Solo en Personalizado. */
  conditions: PlanConditions | null;
  adminEmail: string;
  /** La clave del formulario: la misma en cada reintento, para que crear dos veces sea crear una (CA-6). */
  key: string;
  moveFromPersonal: boolean;
};

export type NewPerson = { email: string; isAdmin: boolean; role: string | null; reason: string; moveFromPersonal: boolean };

/** La cuenta personal donde ya está un correo. */
export type PersonalAccountRef = { id: string; name: string; paysWithStripe: boolean };

/** Por qué el backend no creó o no invitó, en las palabras del panel. */
export type WriteRejection =
  | { code: 'invalid'; message: string }
  | { code: 'plan-rejected'; rejections: string[] }
  | { code: 'email-in-other-company'; company: { id: string; name: string } | null }
  | { code: 'email-in-personal-account'; account: PersonalAccountRef }
  | { code: 'personal-account-pays'; account: PersonalAccountRef }
  | { code: 'unknown-role'; roles: string[] }
  | { code: 'no-seats'; used: number; cap: number | null }
  | { code: 'already-has-seat' | 'seat-revoked' | 'seats-unknown' }
  /** La cuenta ya mandó hoy todas las invitaciones de su tope diario; `retryAt`, desde cuándo se puede volver a invitar. */
  | { code: 'daily-invite-cap'; retryAt: string | null }
  | { code: 'key-used' | 'key-expired' | 'filter-on' | 'move-incomplete' | 'recent-mfa' | 'not-found' | 'in-progress' }
  /** Las acciones sobre una persona: sin login (con el estado de su asiento), la única admin, o un corte que se termina repitiendo. */
  | { code: 'no-login'; seat: SeatStatus | null }
  | { code: 'last-admin' | 'action-incomplete' | 'delete-incomplete' }
  /** Borrar una cuenta: sin la confirmación exacta, cobrando, con otro borrado en curso, o a medias (con lo que falló). */
  | { code: 'confirmation' | 'account-charging' | 'deletion-in-progress' }
  | { code: 'deletion-incomplete'; sites: DeletionSite[] }
  /** Cambiar los asientos: hay más personas que los asientos pedidos, es una cuenta personal, o no es Personalizado. */
  | { code: 'seats-in-use'; used: number }
  | { code: 'personal-account' | 'not-custom' }
  /** Otra operación con los créditos de esa persona escribió primero: se vuelve a intentar. */
  | { code: 'busy' }
  /** La API no respondió a tiempo, o respondió un 5xx: no se sabe si se hizo. */
  | { code: 'unavailable' };

export type CreatedAccount = { company: Company; invitationSent: boolean; movedFrom: string | null };
export type InvitedPerson = { invitationSent: boolean; movedFrom: string | null };
