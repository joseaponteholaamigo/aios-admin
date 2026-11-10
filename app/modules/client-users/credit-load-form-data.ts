// Lo que llega del formulario de «Cargar créditos» de una persona, validado (spec «Créditos por
// persona» de aios-tower, CA-21, CA-22 y CB-11). Puro: lo prueba `tests/person-credits.test.ts`.
import { z } from 'zod';
import { LOAD_MAX, type CreditLoad } from '../../domain/credits';

export const REASON_MAX = 500;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const LOAD = z.object({
  email: z.string().trim().regex(EMAIL, 'Falta la persona.'),
  // Solo dígitos: «11.000» puede ser once mil o once, y «1.5» no es un número de créditos. No se adivina.
  credits: z.string().regex(/^\d+$/, 'Escribe solo dígitos, sin puntos ni comas.').transform(Number)
    .pipe(z.number().min(1, 'Carga al menos un crédito.').max(LOAD_MAX, `Hasta ${LOAD_MAX.toLocaleString('es-CO')} créditos por carga.`)),
  reason: z.string().trim().min(1, 'Escribe el motivo: la factura o el acuerdo.').max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`),
  key: z.string().regex(/^[\w-]{8,100}$/, 'Este formulario no tiene clave: ciérralo y vuelve a abrirlo.'),
});

/** La carga (`{ load }`) o sus errores por campo (`{ errors }`). */
export function readCreditLoad(form: FormData): { load: CreditLoad } | { errors: Record<string, string> } {
  const parsed = LOAD.safeParse({
    email: form.get('email') ?? '', credits: String(form.get('credits') ?? '').trim(), reason: form.get('reason') ?? '', key: form.get('key') ?? '',
  });
  if (!parsed.success) return { errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const { email, credits, reason, key } = parsed.data;
  return { load: { email: email.toLowerCase(), credits, reason, key } };
}
