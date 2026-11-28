// Lo que llega de los formularios de la página de una clave de la casa (spec «Compartir referentes» de
// aios-tower, D16, D17 y D20), validado en su forma: poner o cambiar la clave, quitarla, o encender o
// apagar el proveedor. Puro: lo prueba `tests/house-keys.test.ts`. Si la clave sirve lo juzga el backend,
// que la prueba con el proveedor antes de guardarla.
//
// ⚠️ LA CLAVE NUNCA VUELVE AL NAVEGADOR. Lo que devuelve la acción viaja a la página, y lo escrito que se
// conserva para volver a llenar el formulario (`safeValuesOf`) sale de una lista que no la incluye. Un
// mensaje de error nunca la repite.
import { z } from 'zod';
import type { WriteRejection } from '../../domain/account-creation';
import type { HouseKeyChangeRequest } from '../../domain/house-keys';

/** El campo que dice qué formulario se mandó: viaja con el botón que se oprimió. */
export const INTENT_FIELD = 'intent';
export const HOUSE_KEY_INTENTS = ['key', 'remove', 'switch'] as const;
export type HouseKeyIntent = (typeof HOUSE_KEY_INTENTS)[number];

/** Los nombres de los campos. `key` es el único que lleva la clave. */
export const FIELDS = { key: 'key', reason: 'reason', enable: 'enable', enabled: 'enabled' } as const;

/** El motivo más largo: el mismo que en el resto de las escrituras del backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;
/** La clave más larga que se acepta. Las de ScrapeCreators son mucho más cortas: más que esto es otra cosa pegada. */
export const KEY_MAX = 200;

const NO_REASON = 'Escribe el motivo: queda en la auditoría, en Gobernanza.';
const NO_KEY = 'Pega la clave nueva.';

/** El motivo es obligatorio en toda acción de esta página (D15, como en el backend). */
const reason = z.string(NO_REASON).trim().min(1, NO_REASON).max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`);
/** Los mensajes son fijos: ninguno repite lo pegado. */
const key = z.string(NO_KEY).trim().min(1, NO_KEY).max(KEY_MAX, `La clave va hasta ${KEY_MAX} caracteres: revisa lo que pegaste.`)
  .regex(/^\S+$/, 'La clave no lleva espacios: cópiala de nuevo del panel del proveedor.');
const enabled = z.enum(['true', 'false'], 'ese pedido no se entiende: recarga la página').transform((v) => v === 'true');

const KEY_CHANGE = z.object({ key, reason });
const REMOVAL = z.object({ reason });
const SWITCH = z.object({ enabled, reason });

type Errors = Record<string, string>;

/** Lo escrito que se puede volver a pintar: el motivo y la casilla. Nunca la clave. */
export type SafeValues = { reason?: string; enable?: string };

const SAFE_FIELDS = [FIELDS.reason, FIELDS.enable] as const;

export function safeValuesOf(form: FormData): SafeValues {
  return Object.fromEntries(SAFE_FIELDS.flatMap((name) => {
    const value = form.get(name);
    return typeof value === 'string' ? [[name, value]] : [];
  }));
}

/**
 * Un intento que no se hizo: de qué formulario era (`null`, uno que no existe), lo escrito que se puede volver
 * a pintar, los errores por campo y el rechazo del backend. Cada formulario de la página muestra solo el suyo.
 */
export type HouseKeyAttempt = { intent: HouseKeyIntent | null; values: SafeValues; errors: Errors; rejection: WriteRejection | null };

const isIntent = (value: unknown): value is HouseKeyIntent => HOUSE_KEY_INTENTS.includes(value as HouseKeyIntent);
const errorsOf = (issues: z.core.$ZodIssue[]): Errors => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
const fieldsOf = (form: FormData, names: string[]) => Object.fromEntries(names.map((n) => [n, form.get(n) ?? '']));

/** El cambio que pide el formulario (`{ change }`), sus errores por campo (`{ errors }`), o `intent: null` si no es uno de la página. */
export function readHouseKeyChange(form: FormData):
  | { intent: HouseKeyIntent; change: HouseKeyChangeRequest }
  | { intent: HouseKeyIntent; errors: Errors }
  | { intent: null } {
  const intent = form.get(INTENT_FIELD);
  if (!isIntent(intent)) return { intent: null };
  if (intent === 'key') {
    const p = KEY_CHANGE.safeParse(fieldsOf(form, [FIELDS.key, FIELDS.reason]));
    // La casilla va solo si se marcó: sin ella, guardar la clave no toca el interruptor.
    return p.success
      ? { intent, change: { action: 'key', key: p.data.key, reason: p.data.reason, enable: form.get(FIELDS.enable) === 'on' } }
      : { intent, errors: errorsOf(p.error.issues) };
  }
  if (intent === 'remove') {
    const p = REMOVAL.safeParse(fieldsOf(form, [FIELDS.reason]));
    return p.success ? { intent, change: { action: 'remove', reason: p.data.reason } } : { intent, errors: errorsOf(p.error.issues) };
  }
  const p = SWITCH.safeParse(fieldsOf(form, [FIELDS.enabled, FIELDS.reason]));
  return p.success ? { intent, change: { action: 'switch', enabled: p.data.enabled, reason: p.data.reason } } : { intent, errors: errorsOf(p.error.issues) };
}
