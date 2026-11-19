// Cómo se nombra el estado de un asiento, en las palabras de «Mi equipo». Lo usan las personas de
// los clientes y la ficha de una cuenta personal.
import type { SeatStatus } from '../../domain/client-users';
import type { Label } from '../ui/badge';

const SEAT_STATUS: Record<SeatStatus, Label> = {
  active: { text: 'Activa', tone: 'ok' },
  invited: { text: 'Invitada', tone: 'accent' },
  paused: { text: 'En pausa', tone: 'warn' },
  revoked: { text: 'Revocada', tone: 'bad' },
  unknown: { text: 'Desconocido', tone: '' },
};

export const seatStatusLabel = (status: SeatStatus): Label => SEAT_STATUS[status];
