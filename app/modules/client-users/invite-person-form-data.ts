// Lo que llega del formulario de «Invitar persona», validado (spec «Crear empresas e invitar
// personas», CA-22). Puro: lo prueba `tests/invite-person-form.test.ts`.
import { z } from 'zod';
import type { NewPerson } from '../../domain/account-creation';
import { MOVE_FIELD, MOVE_VALUE } from '../../shared/ui/move-from-personal-notice';

export const REASON_MAX = 500;

/** Lo escrito en el formulario, tal cual, para volver a llenarlo si el backend lo rechaza. */
export type FormValues = Record<string, string>;

export const valuesOf = (form: FormData): FormValues =>
  Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const PERSON = z.object({
  email: z.string().trim().regex(EMAIL, 'Escribe un correo válido.').max(254, 'Ese correo es demasiado largo.'),
  role: z.string().trim().max(64),
  reason: z.string().trim().min(1, 'Escribe el motivo: queda en la auditoría.').max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`),
});

/** El pedido del formulario (`{ person }`) o sus errores por campo (`{ errors }`). */
export function readNewPerson(form: FormData): { person: NewPerson } | { errors: Record<string, string> } {
  const parsed = PERSON.safeParse({ email: form.get('email') ?? '', role: form.get('role') ?? '', reason: form.get('reason') ?? '' });
  if (!parsed.success) return { errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { email, role, reason } = parsed.data;
  return {
    person: { email: email.toLowerCase(), isAdmin: form.get('isAdmin') === 'on', role: role || null, reason, moveFromPersonal: form.get(MOVE_FIELD) === MOVE_VALUE },
  };
}
