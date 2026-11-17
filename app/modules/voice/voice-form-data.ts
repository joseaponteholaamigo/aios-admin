// Lo que llega de los formularios de la pantalla de la voz, validado en su forma (spec «Registro
// abierto» de aios-tower, CA-33): el tope general, la excepción de una cuenta, o quitarla. Puro: lo
// prueba `tests/voice-cap.test.ts`. El fondo (el máximo, una cuenta que no existe o que el filtro
// esconde) lo juzga el backend; el máximo lo frena antes el navegador, con el que dice el backend.
import { z } from 'zod';
import type { WriteRejection } from '../../domain/account-creation';
import type { VoiceCapChange } from '../../domain/voice-cap';

/** El campo que dice qué formulario se mandó: viaja con el botón que se oprimió. */
export const INTENT_FIELD = 'intent';
export const VOICE_INTENTS = ['general', 'exception', 'remove-exception'] as const;
export type VoiceIntent = (typeof VOICE_INTENTS)[number];

/** El motivo más largo que acepta el backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;
/** El id de una cuenta como lo acepta el backend: minúsculas, números y guiones, hasta `ACCOUNT_ID_MAX`. */
export const ACCOUNT_ID_MAX = 80;
export const ACCOUNT_ID = new RegExp(`^[a-z0-9-]{1,${ACCOUNT_ID_MAX}}$`);
/** Dólares, con hasta dos decimales: `8`, `7.5` o `7,50`. */
const DOLLARS = /^\d+(?:[.,]\d{1,2})?$/;

const NO_USD = 'Escribe el tope en dólares.';
const NO_REASON = 'Escribe el motivo: queda en la auditoría.';
const NO_ACCOUNT = 'Escribe el id de la cuenta como aparece en Empresas: minúsculas, números y guiones.';

/** El tope viaja como número: el backend rechaza `"8"`. */
const usd = z.string(NO_USD).trim().min(1, NO_USD).regex(DOLLARS, 'Un número de dólares, con hasta dos decimales.')
  .transform((s) => Number(s.replace(',', '.'))).pipe(z.number().positive('El tope es mayor que 0.'));
const reason = z.string(NO_REASON).trim().min(1, NO_REASON).max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`);
const accountId = z.string(NO_ACCOUNT).trim().toLowerCase().regex(ACCOUNT_ID, NO_ACCOUNT);

const GENERAL = z.object({ usd, reason });
const EXCEPTION = z.object({ accountId, usd, reason });
const REMOVAL = z.object({ accountId, reason });

type Errors = Record<string, string>;

/** Lo escrito, tal cual, para volver a llenar el formulario si no se pudo. */
export type FormValues = Record<string, string>;
export const valuesOf = (form: FormData): FormValues =>
  Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

/**
 * Un intento que no se hizo: de qué formulario era (`null`, uno que no existe), lo escrito, los
 * errores por campo y el rechazo del backend. Cada formulario de la pantalla muestra solo el suyo.
 */
export type VoiceAttempt = { intent: VoiceIntent | null; values: FormValues; errors: Errors; rejection: WriteRejection | null };

const isIntent = (value: unknown): value is VoiceIntent => VOICE_INTENTS.includes(value as VoiceIntent);
const errorsOf = (issues: z.core.$ZodIssue[]): Errors => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
const fieldsOf = (form: FormData, names: string[]) => Object.fromEntries(names.map((n) => [n, form.get(n) ?? '']));

/** El cambio que pide el formulario (`{ change }`), sus errores por campo (`{ errors }`), o `intent: null` si no es uno de la pantalla. */
export function readVoiceCapChange(form: FormData):
  | { intent: VoiceIntent; change: VoiceCapChange }
  | { intent: VoiceIntent; errors: Errors }
  | { intent: null } {
  const intent = form.get(INTENT_FIELD);
  if (!isIntent(intent)) return { intent: null };
  if (intent === 'general') {
    const p = GENERAL.safeParse(fieldsOf(form, ['usd', 'reason']));
    return p.success ? { intent, change: { target: 'general', usd: p.data.usd, reason: p.data.reason } } : { intent, errors: errorsOf(p.error.issues) };
  }
  if (intent === 'exception') {
    const p = EXCEPTION.safeParse(fieldsOf(form, ['accountId', 'usd', 'reason']));
    return p.success ? { intent, change: { target: 'account', ...p.data } } : { intent, errors: errorsOf(p.error.issues) };
  }
  // Quitar la excepción: la cuenta vuelve al general. No lleva tope.
  const p = REMOVAL.safeParse(fieldsOf(form, ['accountId', 'reason']));
  return p.success ? { intent, change: { target: 'account', ...p.data, usd: null } } : { intent, errors: errorsOf(p.error.issues) };
}
