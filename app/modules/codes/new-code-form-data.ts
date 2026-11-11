// Lo que llega del formulario de «Nuevo código», validado en su forma (spec «Códigos de registro»,
// CA-1 a CA-3). Puro: lo prueba `tests/codes.test.ts`. El fondo (una fecha que ya pasó, un código que
// ya existe, una fecha del plan antes del último canje) lo juzga el backend, que dice el campo.
import { z } from 'zod';
import { DURATION_KINDS, type CodeDuration, type NewCode } from '../../domain/codes';
import { thousands } from './code-labels';
import { CODE_MAX, CODE_MIN, LABEL_MAX, MONTHLY_CREDITS_MAX, REASON_MAX, USES_MAX, durationMax } from './code-limits';

/** Lo escrito, tal cual, para volver a llenar el formulario si el backend lo rechaza. */
export type FormValues = Record<string, string>;
export const valuesOf = (form: FormData): FormValues =>
  Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

/**
 * Una fecha y hora del formulario (`2026-11-30T23:59`, lo que da `<input type="datetime-local">`), en
 * hora de Bogotá. Sin zona, el backend la rechaza: en Lambda se leería como UTC, cinco horas antes.
 */
export const bogotaInstant = (local: string) => `${local.length === 16 ? `${local}:00` : local}-05:00`;

/** `2026-11-30T23:59`, o con segundos si el navegador los agrega. */
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WRITTEN_CODE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

/**
 * Un entero escrito. ⚠️ Vacío NO es cero: `z.coerce.number('')` daría 0, y unos créditos borrados
 * viajarían como «sin créditos» en vez de pedir el número.
 */
const whole = (message: string, min: number, max: number) => z.string(message).trim().regex(/^\d+$/, message).transform(Number).pipe(z.number().int(message).min(min, message).max(max, message));
const optionalWhole = (message: string, min: number, max: number) => z.union([z.literal(''), whole(message, min, max)]);

const CODE = z.object({
  code: z.union([z.literal(''), z.string().trim().regex(WRITTEN_CODE, 'Letras, números y guiones, sin espacios ni otros símbolos.').min(CODE_MIN, `Un código escrito a mano lleva al menos ${CODE_MIN} caracteres.`).max(CODE_MAX, `Hasta ${CODE_MAX} caracteres.`)]),
  label: z.string().trim().min(1, 'Escribe una etiqueta: es solo para el equipo.').max(LABEL_MAX, `Hasta ${LABEL_MAX} caracteres.`),
  from: z.union([z.literal(''), z.string().regex(LOCAL, 'Elige la fecha y la hora.')]),
  until: z.string().min(1, 'Elige hasta cuándo sirve el código: ningún código es infinito.').regex(LOCAL, 'Elige la fecha y la hora.'),
  cap: optionalWhole('El tope es un número entero mayor que cero.', 1, USES_MAX),
  durationKind: z.enum(DURATION_KINDS, 'Elige cuánto dura el plan.'),
  monthlyCredits: whole(`Los créditos al mes van de 0 a ${thousands(MONTHLY_CREDITS_MAX)}.`, 0, MONTHLY_CREDITS_MAX),
  dailyBrake: whole('El freno es un número entero mayor que cero.', 1, USES_MAX),
  reason: z.string().trim().max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`),
  key: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, 'El formulario está incompleto: vuelve a abrirlo.'),
});

type Errors = Record<string, string>;
const errorsOf = (issues: z.core.$ZodIssue[]): Errors => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
const FIELDS = ['code', 'label', 'from', 'until', 'cap', 'durationKind', 'monthlyCredits', 'dailyBrake', 'reason', 'key'];

/** La duración elegida: los meses o los días con su número, o la fecha fija. */
function readDuration(kind: (typeof DURATION_KINDS)[number], form: FormData, errors: Errors): CodeDuration | null {
  if (kind === 'no-end') return { kind };
  if (kind === 'until') {
    const date = String(form.get('durationDate') ?? '');
    if (DAY.test(date)) return { kind, date };
    errors.durationDate = 'Elige la fecha en que termina el plan.';
    return null;
  }
  const max = durationMax(kind);
  const n = whole(`Un número entero de 1 a ${max}.`, 1, max).safeParse(form.get('durationN'));
  if (n.success) return { kind, n: n.data };
  errors.durationN = n.error.issues[0]?.message ?? 'Escribe cuánto dura.';
  return null;
}

/** El pedido del formulario (`{ code }`) o sus errores por campo (`{ errors }`). */
export function readNewCode(form: FormData): { code: NewCode } | { errors: Errors } {
  const parsed = CODE.safeParse(Object.fromEntries(FIELDS.map((k) => [k, form.get(k) ?? ''])));
  const errors: Errors = parsed.success ? {} : errorsOf(parsed.error.issues);
  const duration = parsed.success ? readDuration(parsed.data.durationKind, form, errors) : null;
  // Un código escrito a mano se puede adivinar: lleva siempre tope (decisión 6).
  if (parsed.success && parsed.data.code && parsed.data.cap === '') errors.cap = 'Un código escrito a mano lleva siempre tope de usos: se puede adivinar.';
  if (!parsed.success || !duration || Object.keys(errors).length) return { errors };
  const d = parsed.data;
  return {
    code: {
      code: d.code ? d.code.toUpperCase() : null, label: d.label, from: d.from ? bogotaInstant(d.from) : null, until: bogotaInstant(d.until),
      cap: d.cap === '' ? null : d.cap, duration, monthlyCredits: d.monthlyCredits, dailyBrake: d.dailyBrake, reason: d.reason || null, key: d.key,
    },
  };
}
