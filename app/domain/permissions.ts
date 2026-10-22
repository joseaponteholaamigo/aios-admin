// Los permisos del equipo ensō en el panel: un nivel por módulo (decisión 10).
//
// Es la misma regla que aplica el backend (`aios-backend/src/lib/admin/permisos-del-equipo.js`):
// el panel la usa para no mostrar ni servir lo que no corresponde, y el backend la vuelve a
// aplicar en cada pedido, porque esconder no protege. Sin React ni nada del servidor: es dominio.

export const MODULES = [
  'overview',
  'companies',
  'interviews',
  'documents',
  'documentText',
  'skills',
  'clientUsers',
  'usage',
  'governance',
  'upsell',
] as const;
export type Module = (typeof MODULES)[number];

/** De menor a mayor: cada nivel incluye a los anteriores. */
export const LEVELS = ['view', 'edit'] as const;
export type Level = (typeof LEVELS)[number];

/** Los niveles que admite cada módulo. Leer el texto de los documentos va aparte (`documentText`). */
export const MODULE_LEVELS: Record<Module, readonly Level[]> = {
  overview: ['view'],
  companies: ['view', 'edit'],
  interviews: ['view', 'edit'],
  documents: ['view', 'edit'],
  documentText: ['view'],
  skills: ['view', 'edit'],
  clientUsers: ['view', 'edit'],
  usage: ['view', 'edit'],
  governance: ['view'],
  upsell: ['view', 'edit'],
};

export type TeamMember = {
  actor: string;
  email: string | null;
  name: string | null;
  isSuperadmin: boolean;
  /** Cualquier estado que no sea `active` niega todo. */
  status: 'active' | 'inactive';
  permissions: Partial<Record<Module, Level>>;
};

/**
 * ¿Puede usar `module` con `level`? `edit` incluye `view`; el superadministrador puede todo.
 * ⚠️ Un módulo o un nivel que no existen, o una persona inactiva, dan `false`: lo mal declarado niega.
 */
export function can(member: TeamMember, module: Module, level: Level): boolean {
  if (member.status !== 'active') return false;
  if (!MODULE_LEVELS[module]?.includes(level)) return false;
  if (member.isSuperadmin) return true;
  const granted = member.permissions[module];
  if (!granted || !MODULE_LEVELS[module].includes(granted)) return false;
  return LEVELS.indexOf(granted) >= LEVELS.indexOf(level);
}

/** Los módulos que puede usar, con su nivel, en el orden del panel. El superadministrador, todos al máximo. */
export function grantedModules(member: TeamMember): { module: Module; level: Level }[] {
  if (member.status !== 'active') return [];
  return MODULES.flatMap((module) => {
    const level = member.isSuperadmin ? MODULE_LEVELS[module].at(-1) : member.permissions[module];
    return level && can(member, module, level) ? [{ module, level }] : [];
  });
}
