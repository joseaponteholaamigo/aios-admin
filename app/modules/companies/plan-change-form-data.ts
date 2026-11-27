// El formulario de «Cambiar plan» (spec «Editar cuentas y personas», CA-28): con qué viene lleno —lo que
// la cuenta tiene hoy—, qué planes ofrece y lo que manda, validado en su forma. Puro: lo prueba
// `tests/change-plan.test.ts`. El fondo (una fecha que ya pasó, los asientos en uso, un cobro de Stripe)
// lo juzga el backend.
import { z } from 'zod';
import { CREATION_PLANS, PRO_CONDITIONS, QUOTA_RESOURCES, planFitsKind, type ContentLevel, type CreationPlan, type PlanConditions, type Quotas } from '../../domain/account-creation';
import type { AccountKind, CompanyFile, ContentBase } from '../../domain/companies';
import type { PlanChange } from '../../domain/plan-change';
import { defaultConditions, errorsOf, readPlanConditions, type Errors } from './plan-conditions-form-data';

export const REASON_MAX = 500;

/** El botón que se oprimió: ver el cambio, o guardarlo. */
export const INTENT_FIELD = 'intent';
export const PREVIEW_INTENT = 'preview';
export const SAVE_INTENT = 'save';
/** La huella del pedido que se vio, para guardar exactamente ese. */
export const PREVIEWED_FIELD = 'previewed';

/** Los planes que se ofrecen, en este orden: los mismos que al crear (decisión 3). */
export const planChoicesFor = (kind: AccountKind): CreationPlan[] => (kind === 'personal' ? ['free', 'pro', 'custom'] : ['free', 'custom']);

const CONTENT_LEVEL: Record<ContentBase, ContentLevel> = { everything: 'all', free: 'free', nothing: 'none' };

type FileForForm = Pick<CompanyFile, 'kind' | 'plan' | 'conditions' | 'access'>;

/** Una fecha `AAAA-MM-DD` para el campo de fecha, aunque el backend la mande con hora. */
const dayOf = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);

function quotasOf(raw: Record<string, number | null>): Quotas {
  return Object.fromEntries(QUOTA_RESOURCES.filter((r) => r in raw).map((r) => [r, raw[r] ?? null]));
}

/**
 * Las condiciones que la cuenta tiene hoy, para llenar el formulario. El contenido de un Personalizado sale de su
 * acceso (`acceso.base`); lo que no tenga, del caso más común al crear. Una cuenta que no es Personalizado arranca de ese.
 */
export function currentConditions(file: FileForForm): PlanConditions {
  const defaults = defaultConditions(file.kind);
  const c = file.plan === 'custom' ? file.conditions : null;
  if (!c) return defaults;
  const content = file.access?.base ?? c.content;
  return {
    content: content ? CONTENT_LEVEL[content] : defaults.content,
    seats: file.kind === 'personal' ? 1 : c.seats ?? defaults.seats,
    team: file.kind === 'personal' ? false : c.team ?? defaults.team,
    schedules: c.scheduling ?? defaults.schedules,
    endsOn: dayOf(c.until),
    quotas: quotasOf(c.quotas),
  };
}

/** ¿Son las condiciones del Pro del panel? Solo la fecha de fin puede cambiar. */
const isPro = (c: PlanConditions) =>
  c.content === PRO_CONDITIONS.content && c.seats === PRO_CONDITIONS.seats && c.team === PRO_CONDITIONS.team
  && c.schedules === PRO_CONDITIONS.schedules && Object.keys(c.quotas).length === 0;

/** El plan que la cuenta tiene hoy entre los que se ofrecen, o `null` (un Pro o un Team comprado en la web). */
export function currentPlanChoice(file: FileForForm): CreationPlan | null {
  if (file.plan === 'free') return 'free';
  if (file.plan !== 'custom') return null;
  return file.kind === 'personal' && isPro(currentConditions(file)) ? 'pro' : 'custom';
}

const BASE = z.object({
  kind: z.enum(['company', 'personal']),
  plan: z.enum(CREATION_PLANS, 'Elige el plan.'),
  reason: z.string().trim().max(REASON_MAX, `El motivo va hasta ${REASON_MAX} caracteres.`),
});

/** El cambio sin decir si es solo para verlo (`{ change }`), o sus errores por campo (`{ errors }`). */
export function readPlanChange(form: FormData): { change: Omit<PlanChange, 'previewOnly'> } | { errors: Errors } {
  const base = BASE.safeParse({ kind: form.get('kind') ?? '', plan: form.get('plan') ?? '', reason: form.get('reason') ?? '' });
  if (!base.success) return { errors: errorsOf(base.error.issues) };
  const { kind, plan, reason } = base.data;
  const errors: Errors = planFitsKind(plan, kind) ? {} : { plan: 'Pro es solo para una cuenta personal.' };
  const conditions = readPlanConditions(form, plan, kind, errors);
  if (Object.keys(errors).length) return { errors };
  // Free no lleva condiciones; Pro y Personalizado sí, y los dos son un Personalizado para el backend.
  return { change: { target: conditions ? { plan: 'custom', conditions } : { plan: 'free' }, reason } };
}

/**
 * La huella de un pedido. «Guardar» manda la del que se vio: si lo escrito cambió después, la acción vuelve a mostrar
 * la vista previa en vez de guardar algo que nadie vio (CA-28: «Guardar» manda el mismo pedido).
 */
export const planChangeFingerprint = (change: Omit<PlanChange, 'previewOnly'>) => JSON.stringify(change);
