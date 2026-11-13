// El equipo ENSŌ visto por el superadministrador (spec «Equipo ENSŌ»): cada persona con su
// invitación, y qué acciones admite su estado. Sin React ni servidor: es dominio.
import type { Level, Module, TeamMember } from './permissions';

/** Cómo va la invitación: nunca entró y su contraseña temporal vale, ya venció, o ya entró. */
export type Invitation = 'pending' | 'expired' | 'accepted';

/**
 * Una persona del equipo en «Equipo ensō». `invitation` es `null` si el login no respondió o si está
 * retirada. `version`: la que se vio al abrir la página; guardar o actuar la manda, y si otro cambió a
 * la persona entretanto, el backend responde `conflict` en vez de pisar ese cambio (CB-9).
 */
export type TeamPerson = TeamMember & { sub: string; invitation: Invitation | null; version: string | null };

/** Lo que responde el alta: la persona, y si su cuenta del login es nueva (si no, el correo le llegó antes). */
export type CreatedTeamMember = { person: TeamPerson; accountWasNew: boolean };

export type TeamPermissions = Partial<Record<Module, Level>>;

/** Las acciones sobre una persona, en el orden en que se ofrecen. */
export const TEAM_ACTIONS = ['resend-invitation', 'reset-mfa', 'reactivate', 'suspend', 'retire'] as const;
export type TeamAction = (typeof TEAM_ACTIONS)[number];

/**
 * Lo que su estado permite (CA-18). Reenviar la invitación solo a quien nunca entró, y solo si se
 * sabe: sin respuesta del login no se ofrece.
 */
export function teamActionsFor(person: Pick<TeamPerson, 'status' | 'invitation'>): TeamAction[] {
  if (person.status === 'retired') return [];
  if (person.status === 'inactive') return ['reactivate', 'retire'];
  const neverEntered = person.invitation === 'pending' || person.invitation === 'expired';
  return [...(neverEntered ? (['resend-invitation'] as const) : []), 'reset-mfa', 'suspend', 'retire'];
}

/** El alta de una persona: lo que manda «Nueva persona». */
export type NewTeamMember = { email: string; name: string | null; permissions: TeamPermissions; isSuperadmin: boolean; reason: string; key: string };

/** Un cambio de permisos de una persona, con la versión que se vio. */
export type PermissionsChange = { permissions: TeamPermissions; isSuperadmin: boolean; reason: string; version: string | null };
