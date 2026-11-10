// Lo que llega del formulario de «Cambiar asientos», validado (spec «Créditos por persona» de
// aios-tower, CA-19). Puro: lo prueba `tests/company-seats.test.ts`. El tope y los mínimos son los del
// backend, que los vuelve a revisar.
import { z } from 'zod';
import type { SeatsChange } from '../../domain/credits';

/** Una red contra un tecleo de más, como en el backend. */
export const SEATS_MAX = 1000;
export const REASON_MAX = 500;

const SEATS = z.object({
  seats: z.coerce.number({ message: 'Escribe un número.' }).int('Los asientos son un número entero.').min(1, 'Una empresa tiene al menos un asiento.').max(SEATS_MAX, `Hasta ${SEATS_MAX} asientos.`),
  reason: z.string().trim().min(1, 'Escribe el motivo: queda en la auditoría.').max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`),
});

/** El cambio (`{ change }`) o sus errores por campo (`{ errors }`). */
export function readSeatsChange(form: FormData): { change: SeatsChange } | { errors: Record<string, string> } {
  const parsed = SEATS.safeParse({ seats: String(form.get('seats') ?? '').trim(), reason: form.get('reason') ?? '' });
  if (!parsed.success) return { errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  return { change: { seats: parsed.data.seats, reason: parsed.data.reason } };
}
