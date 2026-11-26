// Lo que llega del formulario de «Nueva empresa» y «Nueva cuenta personal», validado (spec «Crear
// empresas e invitar personas», CA-17). Puro: lo prueba `tests/new-account-form.test.ts`. Las
// condiciones del plan se leen en `plan-conditions-form-data.ts`, que comparte con «Cambiar plan».
import { z } from 'zod';
import { CREATION_PLANS, planFitsKind, type NewAccount } from '../../domain/account-creation';
import { MOVE_FIELD, MOVE_VALUE } from '../../shared/ui/move-from-personal-notice';
import { errorsOf, readPlanConditions, type Errors } from './plan-conditions-form-data';

export const NAME_MAX = 120;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const ACCOUNT = z.object({
  kind: z.enum(['company', 'personal']),
  name: z.string().trim().min(1, 'Escribe el nombre.').max(NAME_MAX, `El nombre va hasta ${NAME_MAX} caracteres.`),
  plan: z.enum(CREATION_PLANS, 'Elige el plan.'),
  adminEmail: z.string().trim().regex(EMAIL, 'Escribe un correo válido.').max(254, 'Ese correo es demasiado largo.'),
  key: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, 'El formulario está incompleto: vuelve a abrirlo.'),
});

/** El pedido del formulario (`{ account }`) o sus errores por campo (`{ errors }`). */
export function readNewAccount(form: FormData): { account: NewAccount } | { errors: Errors } {
  const base = ACCOUNT.safeParse(Object.fromEntries(['kind', 'name', 'plan', 'adminEmail', 'key'].map((k) => [k, form.get(k) ?? ''])));
  const errors: Errors = base.success ? {} : errorsOf(base.error.issues);
  const kind = base.success ? base.data.kind : 'company';
  const plan = base.success ? base.data.plan : null;
  if (plan && !planFitsKind(plan, kind)) errors.plan = 'Pro es solo para una cuenta personal.';
  const conditions = plan ? readPlanConditions(form, plan, kind, errors) : null;
  if (!base.success || Object.keys(errors).length) return { errors };
  return {
    account: { ...base.data, adminEmail: base.data.adminEmail.toLowerCase(), conditions, moveFromPersonal: form.get(MOVE_FIELD) === MOVE_VALUE },
  };
}
