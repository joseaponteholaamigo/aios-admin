// La traducción de `/v1/admin/yo` al idioma del panel (CA-30, decisión H).
//
// El backend nombra los módulos y los niveles en español (`empresas`, `ver`) y el panel en inglés.
// Este es el único lugar donde se cruzan: el resto del panel nunca ve un nombre del backend.
// Un módulo o un nivel desconocido (el backend agregó uno y el panel todavía no) se descarta y
// queda en el log, sin romper la página: descartarlo niega, nunca abre.
import { MODULE_LEVELS, type Level, type Module, type TeamMember } from '../../domain/permissions';

const MODULE_FROM_API = new Map<string, Module>([
  ['vista-general', 'overview'],
  ['empresas', 'companies'],
  ['entrevistas', 'interviews'],
  ['documentos', 'documents'],
  ['documentos-texto', 'documentText'],
  ['skills', 'skills'],
  ['usuarios', 'clientUsers'],
  ['consumo', 'usage'],
  ['gobernanza', 'governance'],
  ['upsell', 'upsell'],
]);

const LEVEL_FROM_API = new Map<string, Level>([
  ['ver', 'view'],
  ['editar', 'edit'],
]);

const ACTIVE_STATUS = 'activa';

/** La respuesta no es la de `/yo`: el contrato con el backend se rompió. */
export class TeamMemberContractError extends Error {}

const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

function mapPermissions(raw: unknown, log: (message: string) => void): TeamMember['permissions'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TeamMemberContractError('`/yo` sin `permisos`');
  const permissions: TeamMember['permissions'] = {};
  for (const [apiModule, apiLevel] of Object.entries(raw)) {
    const module = MODULE_FROM_API.get(apiModule);
    const level = typeof apiLevel === 'string' ? LEVEL_FROM_API.get(apiLevel) : undefined;
    if (!module || !level || !MODULE_LEVELS[module].includes(level)) {
      log(`/yo trae un permiso que el panel no conoce y se descarta: ${JSON.stringify(apiModule)} → ${JSON.stringify(apiLevel)}`);
      continue;
    }
    permissions[module] = level;
  }
  return permissions;
}

/** La persona del equipo, en el idioma del panel. **Lanza** si la respuesta no tiene la forma de `/yo`. */
export function toTeamMember(body: unknown, log: (message: string) => void): TeamMember {
  if (!body || typeof body !== 'object') throw new TeamMemberContractError('`/yo` no devolvió un objeto');
  const b = body as Record<string, unknown>;
  if (typeof b.actor !== 'string' || !b.actor) throw new TeamMemberContractError('`/yo` sin `actor`');
  if (b.estado !== ACTIVE_STATUS && b.estado !== 'suspendida') log(`/yo trae un estado que el panel no conoce: ${JSON.stringify(b.estado)}`);
  return {
    actor: b.actor,
    email: stringOrNull(b.correo),
    name: stringOrNull(b.nombre),
    isSuperadmin: b.superadmin === true,
    status: b.estado === ACTIVE_STATUS ? 'active' : 'inactive',
    permissions: mapPermissions(b.permisos, log),
  };
}
