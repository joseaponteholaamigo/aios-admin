// Lo que llega de los formularios del equipo ENSŌ (spec «Equipo ENSŌ», CA-15 a CA-18), validado en
// su forma. Puro: lo prueba `tests/team.test.ts`. El fondo (el dominio del correo, un correo que ya
// está, el estado de la persona) lo juzga el backend, que dice el campo.
import { z } from 'zod';
import { MODULES, MODULE_LEVELS, type Level, type Module } from '../../domain/permissions';
import type { NewTeamMember, PermissionsChange, TeamPermissions } from '../../domain/team';
import { modulesWithScreen } from '../../shared/routing/route-access';

export const NAME_MAX = 80;
export const REASON_MAX = 500;
/** Solo para decirlo junto al campo: la regla la aplica el backend (decisión 5). */
export const TEAM_EMAIL_DOMAIN = 'beenso.com';

export const permissionField = (module: Module) => `perm.${module}`;
export const SUPERADMIN_FIELD = 'isSuperadmin';
export const INTENT_FIELD = 'intent';

/** Lo escrito, tal cual, para volver a llenar el formulario si el backend lo rechaza. */
export type FormValues = Record<string, string>;
export const valuesOf = (form: FormData): FormValues =>
  Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

/**
 * Los permisos del formulario: cada módulo con un nivel que admite. Un valor vacío o que el módulo
 * no admite es «sin acceso». Lee también los módulos escondidos (sin pantalla), que viajan en un
 * campo oculto para no perderse al guardar (decisión 3).
 */
export function readPermissions(form: FormData): TeamPermissions {
  return Object.fromEntries(MODULES.flatMap((module) => {
    const value = form.get(permissionField(module));
    return typeof value === 'string' && (MODULE_LEVELS[module] as readonly string[]).includes(value) ? [[module, value as Level]] : [];
  }));
}

const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i;
const NEW_MEMBER = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL, 'Escribe un correo.'),
  name: z.string().trim().max(NAME_MAX, `Hasta ${NAME_MAX} caracteres.`),
  reason: z.string().trim().min(1, 'Escribe el motivo: queda en la auditoría.').max(REASON_MAX, `Hasta ${REASON_MAX} caracteres.`),
  key: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, 'El formulario está incompleto: vuelve a abrirlo.'),
});
const REASON = z.string().trim().min(1, 'Escribe el motivo: queda en la auditoría.').max(REASON_MAX, `Hasta ${REASON_MAX} caracteres.`);

type Errors = Record<string, string>;
const errorsOf = (issues: z.core.$ZodIssue[]): Errors => Object.fromEntries(issues.map((i) => [String(i.path[0] ?? 'reason'), i.message]));
const text = (form: FormData, field: string) => String(form.get(field) ?? '');

/** El alta del formulario (`{ member }`) o sus errores por campo (`{ errors }`). */
export function readNewTeamMember(form: FormData): { member: NewTeamMember } | { errors: Errors } {
  const parsed = NEW_MEMBER.safeParse({ email: text(form, 'email'), name: text(form, 'name'), reason: text(form, 'reason'), key: text(form, 'key') });
  if (!parsed.success) return { errors: errorsOf(parsed.error.issues) };
  const d = parsed.data;
  return {
    member: { email: d.email, name: d.name || null, permissions: readPermissions(form), isSuperadmin: form.get(SUPERADMIN_FIELD) === '1', reason: d.reason, key: d.key },
  };
}

/** Un cambio de permisos (`{ change }`) o el error del motivo (`{ errors }`). */
export function readPermissionsChange(form: FormData): { change: PermissionsChange } | { errors: Errors } {
  const reason = REASON.safeParse(text(form, 'reason'));
  if (!reason.success) return { errors: { reason: reason.error.issues[0]?.message ?? 'Escribe el motivo.' } };
  return { change: { permissions: readPermissions(form), isSuperadmin: form.get(SUPERADMIN_FIELD) === '1', reason: reason.data } };
}

/** El motivo de una acción, o `null` si falta. */
export function readActionReason(form: FormData): string | null {
  const reason = REASON.safeParse(text(form, 'reason'));
  return reason.success ? reason.data : null;
}

const CON_PANTALLA = new Set<Module>(modulesWithScreen());

/**
 * Los permisos de una persona, partidos: los de módulos con pantalla, que se editan, y los de módulos
 * sin pantalla, que viajan ocultos para no perderse al guardar (decisión 3).
 */
export function splitPermissions(permissions: TeamPermissions): { shown: TeamPermissions; hidden: TeamPermissions } {
  const entries = Object.entries(permissions) as [Module, Level][];
  return {
    shown: Object.fromEntries(entries.filter(([m]) => CON_PANTALLA.has(m))),
    hidden: Object.fromEntries(entries.filter(([m]) => !CON_PANTALLA.has(m))),
  };
}
