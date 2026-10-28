// Cómo se nombran el estado de un asiento y lo que ve una persona, en las palabras de «Mi equipo».
import type { ClientRole, ItemCounts, PersonSees, SeatStatus } from '../../domain/client-users';
import type { Label } from '../../shared/ui/badge';

export { badgeClass } from '../../shared/ui/badge';

const SEAT_STATUS: Record<SeatStatus, Label> = {
  active: { text: 'Activa', tone: 'ok' },
  invited: { text: 'Invitada', tone: 'accent' },
  paused: { text: 'En pausa', tone: 'warn' },
  revoked: { text: 'Revocada', tone: 'bad' },
  unknown: { text: 'Desconocido', tone: '' },
};

export const seatStatusLabel = (status: SeatStatus): Label => SEAT_STATUS[status];

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
