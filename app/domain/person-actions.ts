// Las acciones del equipo de ENSŌ sobre una persona de una cuenta: destrabarla o borrarla (spec «Borrar
// cuentas y destrabar personas», CA-9 a CA-12), y cambiarle el rol, reenviarle la invitación o revocarle
// el acceso (spec «Editar cuentas y personas», CA-24 a CA-26). El panel niega antes para no ofrecer lo
// que no corresponde; el backend lo vuelve a revisar.
import type { SeatStatus } from './client-users';
import { can, type TeamMember } from './permissions';

/** En el orden del menú: de lo que cambia poco a lo que no tiene vuelta. */
export const PERSON_ACTIONS = ['change-role', 'resend-invitation', 'reset-mfa', 'delete-login', 'revoke', 'delete-person'] as const;
export type PersonAction = (typeof PERSON_ACTIONS)[number];

/**
 * Lo que se le hace a la persona de una cuenta personal: destrabarla. No se borra porque es la única (CB-4), se
 * borra la cuenta; y su rol, su acceso y su invitación no se cambian, porque es su admin y su dueña (CA-24).
 */
export const PERSONAL_ACCOUNT_ACTIONS: readonly PersonAction[] = ['reset-mfa', 'delete-login'];

export const isPersonAction = (value: unknown): value is PersonAction => PERSON_ACTIONS.includes(value as PersonAction);

/** Quién pide, en lo que deciden estas acciones: si es superadministrador y si puede editar Usuarios de clientes. */
export type PersonActionsActor = { superadmin: boolean; editUsers: boolean };

export const actorOf = (member: TeamMember | null | undefined): PersonActionsActor => ({
  superadmin: member?.status === 'active' && member.isSuperadmin,
  editUsers: member ? can(member, 'clientUsers', 'edit') : false,
});

/** Cambiar el rol y reenviar la invitación piden lo mismo que invitar; lo demás casi no tiene vuelta y es del superadministrador (decisión 2). */
const WITH_EDIT_USERS: readonly PersonAction[] = ['change-role', 'resend-invitation'];

export const allowsPersonAction = (actor: PersonActionsActor, action: PersonAction) =>
  actor.superadmin || (actor.editUsers && WITH_EDIT_USERS.includes(action));

/** Un asiento vivo: el de quien ocupa un lugar o lo tiene en pausa. Un revocado ya no se cambia ni se revoca. */
const LIVE_SEATS: readonly SeatStatus[] = ['active', 'invited', 'paused'];

/** ¿La acción tiene sentido para un asiento en ese estado? Solo se reenvía a quien todavía no entró (CA-24). */
function fitsSeat(action: PersonAction, status: SeatStatus): boolean {
  if (action === 'resend-invitation') return status === 'invited';
  if (action === 'change-role' || action === 'revoke') return LIVE_SEATS.includes(status);
  return true;
}

/** Lo que `actor` puede hacerle a una persona con ese asiento, en el orden del menú. */
export function personActionsFor(status: SeatStatus, personal: boolean, actor: PersonActionsActor): PersonAction[] {
  const offered = personal ? PERSONAL_ACCOUNT_ACTIONS : PERSON_ACTIONS;
  return offered.filter((action) => allowsPersonAction(actor, action) && fitsSeat(action, status));
}

/** Qué acción y sobre quién: lo que abre su diálogo. */
export type PersonActionTarget = { action: PersonAction; email: string };

/** Lo que cambia de un rol: `undefined` no toca; `role: null` deja sin rol (CA-7). */
export type RoleChange = { role?: string | null; isAdmin?: boolean };

/**
 * Lo que pide el panel: la acción, a quién y lo que cada una necesita. El correo viaja en el cuerpo, nunca en la
 * dirección (CA-8 de «Borrar cuentas y destrabar personas»); el motivo vacío no viaja.
 */
export type PersonActionRequest =
  | { action: Exclude<PersonAction, 'change-role' | 'revoke'>; email: string }
  | { action: 'change-role'; email: string; change: RoleChange; reason: string }
  | { action: 'revoke'; email: string; reason: string };

/**
 * Lo que quedó hecho. `appUnlinked` solo dice algo al restablecer: si había una app que desvincular.
 * `noticeEmail` es el correo de aviso o el de la invitación reenviada, y `null` cuando no correspondía uno.
 */
export type PersonActionDone = { action: PersonAction; appUnlinked: boolean | null; noticeEmail: 'sent' | 'not-sent' | null };
