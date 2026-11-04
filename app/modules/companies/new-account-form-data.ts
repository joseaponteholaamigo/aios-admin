// Lo que llega del formulario de «Nueva empresa» y «Nueva cuenta personal», validado (spec «Crear
// empresas e invitar personas», CA-17), y con qué viene lleno al abrirlo. Puro: lo prueba
// `tests/new-account-form.test.ts`. El fondo del plan (una fecha que ya pasó, un paquete que no está
// publicado) lo juzga el backend: aquí solo la forma de cada campo.
import { z } from 'zod';
import { CONTENT_LEVELS, CREATION_PLANS, QUOTA_RESOURCES, type NewAccount, type PlanConditions, type Quotas } from '../../domain/account-creation';
import type { AccountKind } from '../../domain/companies';
import { MOVE_FIELD, MOVE_VALUE } from '../../shared/ui/move-from-personal-notice';

export const NAME_MAX = 120;
export const REASON_MAX = 500;

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

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const ACCOUNT = z.object({
  kind: z.enum(['company', 'personal']),
  name: z.string().trim().min(1, 'Escribe el nombre.').max(NAME_MAX, `El nombre va hasta ${NAME_MAX} caracteres.`),
  plan: z.enum(CREATION_PLANS, 'Elige el plan.'),
  adminEmail: z.string().trim().regex(EMAIL, 'Escribe un correo válido.').max(254, 'Ese correo es demasiado largo.'),
  reason: z.string().trim().min(1, 'Escribe el motivo: queda en la auditoría.').max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`),
  key: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, 'El formulario está incompleto: vuelve a abrirlo.'),
});

const CONDITIONS = z.object({
  content: z.enum(CONTENT_LEVELS, 'Elige el contenido.'),
  seats: z.coerce.number('Escribe cuántos asientos.').int('Los asientos van en números enteros.').min(1, 'Al menos un asiento.'),
  endsOn: z.union([z.literal(''), z.string().regex(DAY, 'La fecha va como AAAA-MM-DD.')]),
});

type Errors = Record<string, string>;
const errorsOf = (issues: z.core.$ZodIssue[]): Errors => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

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

function readConditions(form: FormData, kind: AccountKind, errors: Errors): PlanConditions | null {
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

/** El pedido del formulario (`{ account }`) o sus errores por campo (`{ errors }`). */
export function readNewAccount(form: FormData): { account: NewAccount } | { errors: Errors } {
  const base = ACCOUNT.safeParse(Object.fromEntries(['kind', 'name', 'plan', 'adminEmail', 'reason', 'key'].map((k) => [k, form.get(k) ?? ''])));
  const errors: Errors = base.success ? {} : errorsOf(base.error.issues);
  const kind = base.success ? base.data.kind : 'company';
  const conditions = base.success && base.data.plan === 'custom' ? readConditions(form, kind, errors) : null;
  if (!base.success || Object.keys(errors).length) return { errors };
  return {
    account: { ...base.data, adminEmail: base.data.adminEmail.toLowerCase(), conditions, moveFromPersonal: form.get(MOVE_FIELD) === MOVE_VALUE },
  };
}
