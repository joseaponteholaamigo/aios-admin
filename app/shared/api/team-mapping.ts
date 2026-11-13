// La traducción del equipo ENSŌ entre el panel y el backend (`/v1/admin/equipo*`, spec «Equipo
// ENSŌ»): cada persona con su invitación, el alta, el cambio de permisos y las acciones. La forma de
// una persona es la de `/yo` (`team-member-mapping.ts`) más su invitación.
import type { Invitation, NewTeamMember, PermissionsChange, TeamAction, TeamPerson } from '../../domain/team';
import { subOf } from '../../domain/team';
import { TeamMemberContractError, toApiPermissions, toTeamMember } from './team-member-mapping';

const INVITATION_FROM_API: Record<string, Invitation> = { pendiente: 'pending', vencida: 'expired', aceptada: 'accepted' };

/** Una persona del equipo con su invitación. **Lanza** si no tiene la forma de `/yo`. */
export function toTeamPerson(raw: unknown, log: (message: string) => void): TeamPerson {
  const member = toTeamMember(raw, log);
  const invitation = (raw as Record<string, unknown>).invitacion;
  return { ...member, sub: subOf(member.actor), invitation: typeof invitation === 'string' ? INVITATION_FROM_API[invitation] ?? null : null };
}

/** La lista del equipo (`GET /v1/admin/equipo`). */
export function toTeamPeople(body: unknown, log: (message: string) => void): TeamPerson[] {
  const personas = body && typeof body === 'object' ? (body as Record<string, unknown>).personas : undefined;
  if (!Array.isArray(personas)) throw new TeamMemberContractError('`/equipo` sin `personas`');
  return personas.map((p) => toTeamPerson(p, log));
}

/** Una persona (`{ persona }`): el detalle, el alta, un cambio de permisos o una acción. */
export function toTeamPersonBody(body: unknown, log: (message: string) => void): TeamPerson {
  const persona = body && typeof body === 'object' ? (body as Record<string, unknown>).persona : undefined;
  if (!persona) throw new TeamMemberContractError('la respuesta del equipo sin `persona`');
  return toTeamPerson(persona, log);
}

/** El cambio de permisos responde la persona sola, sin `{ persona }`. */
export const toChangedTeamPerson = (body: unknown, log: (message: string) => void) => toTeamPerson(body, log);

export function toBackendNewTeamMember(m: NewTeamMember) {
  return { correo: m.email, nombre: m.name, permisos: toApiPermissions(m.permissions), superadmin: m.isSuperadmin, motivo: m.reason, clave: m.key };
}

export function toBackendPermissionsChange(c: PermissionsChange) {
  return { permisos: toApiPermissions(c.permissions), superadmin: c.isSuperadmin, motivo: c.reason };
}

/** Cada acción del panel, en el nombre de la ruta del backend. */
const ACTION_TO_API: Record<TeamAction, string> = {
  suspend: 'suspender', reactivate: 'reactivar', 'resend-invitation': 'reenviar-invitacion', 'reset-mfa': 'restablecer-mfa', retire: 'retirar',
};

const personPath = (sub: string) => `/v1/admin/equipo/${encodeURIComponent(sub)}`;
export const teamPersonPath = personPath;
export const teamPermissionsPath = (sub: string) => `${personPath(sub)}/permisos`;
export const teamActionPath = (sub: string, action: TeamAction) => `${personPath(sub)}/${ACTION_TO_API[action]}`;

/** El campo que señala un rechazo `invalido` del alta del equipo, en el nombre del formulario. */
export const TEAM_FIELD_FROM_API: Record<string, string> = {
  correo: 'email', nombre: 'name', permisos: 'permissions', superadmin: 'isSuperadmin',
};
