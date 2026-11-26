// Las condiciones de un plan en un formulario, validadas en su forma: las de un Personalizado
// (`plan-conditions-fields`) y la fecha de fin del Pro del panel. Las leen «Nueva empresa» y «Cambiar
// plan» (specs «Crear empresas e invitar personas», CA-17, y «Editar cuentas y personas», CA-28). Puro.
// El fondo (una fecha que ya pasó, un paquete que no está publicado) lo juzga el backend.
import { z } from 'zod';
import { CONTENT_LEVELS, PRO_CONDITIONS, QUOTA_RESOURCES, type CreationPlan, type PlanConditions, type Quotas } from '../../domain/account-creation';
import type { AccountKind } from '../../domain/companies';

/** El caso más común al abrir el formulario (CA-17). Una cuenta personal: un asiento y sin equipo. */
export function defaultConditions(kind: AccountKind): PlanConditions {
  return kind === 'personal'
    ? { content: 'all', seats: 1, team: false, schedules: true, endsOn: null, quotas: {} }
    : { content: 'all', seats: 2, team: true, schedules: true, endsOn: null, quotas: {} };
}

/** Lo escrito en el formulario, tal cual, para volver a llenarlo si el backend lo rechaza (CA-19). */
export type FormValues = Record<string, string>;

export const valuesOf = (form: FormData): FormValues =>
  Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

export const quotaField = (resource: (typeof QUOTA_RESOURCES)[number]) => `quota-${resource}`;

/**
 * La fecha de fin del Pro. Va en su propio campo: el `endsOn` de las condiciones de Personalizado sigue en el formulario
 * aunque esté oculto, y con el mismo nombre se leería uno por otro.
 */
export const PRO_ENDS_ON_FIELD = 'proEndsOn';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const CONDITIONS = z.object({
  content: z.enum(CONTENT_LEVELS, 'Elige el contenido.'),
  seats: z.coerce.number('Escribe cuántos asientos.').int('Los asientos van en números enteros.').min(1, 'Al menos un asiento.'),
  endsOn: z.union([z.literal(''), z.string().regex(DAY, 'La fecha va como AAAA-MM-DD.')]),
});

export type Errors = Record<string, string>;
export const errorsOf = (issues: z.core.$ZodIssue[]): Errors => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

/** Los cupos escritos: vacío no se manda (queda sin tope, como el plan); un número es el cupo. */
function readQuotas(form: FormData, errors: Errors): Quotas {
  const quotas: Quotas = {};
  for (const resource of QUOTA_RESOURCES) {
    const raw = String(form.get(quotaField(resource)) ?? '').trim();
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0) quotas[resource] = n;
    else errors[quotaField(resource)] = 'Un número entero desde 0, o vacío para sin tope.';
  }
  return quotas;
}

function readCustomConditions(form: FormData, kind: AccountKind, errors: Errors): PlanConditions | null {
  const personal = kind === 'personal';
  const parsed = CONDITIONS.safeParse({
    content: form.get('content'), seats: personal ? 1 : form.get('seats'), endsOn: String(form.get('endsOn') ?? ''),
  });
  if (!parsed.success) Object.assign(errors, errorsOf(parsed.error.issues));
  const quotas = readQuotas(form, errors);
  if (!parsed.success) return null;
  const { content, seats, endsOn } = parsed.data;
  return { content, seats, team: personal ? false : form.get('team') === 'on', schedules: form.get('schedules') === 'on', endsOn: endsOn || null, quotas };
}

/** Las condiciones de Pro, fijas, con la fecha de fin que se eligió (vacía: sin fecha de fin). */
function readProConditions(form: FormData, errors: Errors): PlanConditions {
  const endsOn = String(form.get(PRO_ENDS_ON_FIELD) ?? '').trim();
  if (endsOn && !DAY.test(endsOn)) errors[PRO_ENDS_ON_FIELD] = 'La fecha va como AAAA-MM-DD.';
  return { ...PRO_CONDITIONS, quotas: {}, endsOn: endsOn || null };
}

/**
 * Las condiciones del plan elegido: las escritas en Personalizado, las fijas de Pro con su fecha de fin, o ninguna en
 * Free. Pro no lee las condiciones del formulario aunque alguien las mande. Los errores quedan en `errors`.
 */
export function readPlanConditions(form: FormData, plan: CreationPlan, kind: AccountKind, errors: Errors): PlanConditions | null {
  if (plan === 'custom') return readCustomConditions(form, kind, errors);
  if (plan === 'pro') return readProConditions(form, errors);
  return null;
}
