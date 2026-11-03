// Cómo se nombran el estado de un asiento y lo que ve una persona, en las palabras de «Mi equipo».
import type { ClientRole, ItemCounts, PersonSees } from '../../domain/client-users';
import type { PageInfo } from '../../domain/pagination';

export { badgeClass } from '../../shared/ui/badge';
export { seatStatusLabel } from '../../shared/labels/seat-status-labels';

/** Qué filtra la lista: nada, una empresa del filtro, un id en la URL que no está entre ellas, o solo las cuentas personales. */
export type ListFilter = { kind: 'all' } | { kind: 'company'; name: string } | { kind: 'unknown-company' } | { kind: 'personal' };

/**
 * Qué dice la lista cuando no trae a nadie. Con un total, la lista no está vacía: se pagina el índice
 * de correos, y las entradas de esta página no tienen asiento (las muestra la revisión de datos).
 */
export function emptyListMessage(filter: ListFilter, page: PageInfo): string {
  if (page.total > 0) return 'En esta página no quedan personas vigentes: sus entradas no tienen asiento (las muestra la revisión de datos).';
  if (filter.kind === 'unknown-company') return 'Esa empresa no está entre las que el panel muestra.';
  if (filter.kind === 'company') return `${filter.name} no tiene personas activas, invitadas ni en pausa.`;
  if (filter.kind === 'personal') return 'Ninguna cuenta personal tiene personas activas, invitadas ni en pausa.';
  return 'Todavía no hay personas para mostrar.';
}

/** El rol de un asiento: la admin primero, porque ve todo aunque además tenga un rol. */
export const roleLabel = (seat: { isAdmin: boolean; role: string | null }) => (seat.isAdmin ? 'Admin de la empresa' : seat.role ?? 'Sin rol');

const plusAdjustments = (n: number) => (n ? ` + ${n} ajuste${n === 1 ? '' : 's'}` : '');

/** Qué ve una persona, como la columna «Ve» de «Mi equipo». */
export function seesLabel(sees: PersonSees, roles: ClientRole[]): string {
  const roleName = (slug: string) => roles.find((r) => r.slug === slug)?.label ?? slug;
  switch (sees.kind) {
    case 'admin': return 'Todo lo de la empresa (admin)';
    case 'role': return `Su rol: ${roleName(sees.role)}${plusAdjustments(sees.adjustments)}`;
    case 'everything': return `Todo lo de la empresa${plusAdjustments(sees.adjustments)}`;
    case 'chosen': return `Solo lo elegido (${sees.chosen})`;
    case 'missing-role': return `Un rol que ya no existe (${sees.role})`;
    default: return '—';
  }
}

export const countsLabel = (c: ItemCounts) => `${c.skills} skills · ${c.agents} agentes · ${c.chains} cadenas`;
