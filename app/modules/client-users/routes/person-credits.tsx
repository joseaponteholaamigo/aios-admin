// El saldo de créditos de una persona, para el diálogo de «Créditos» de la lista de personas (spec
// «Créditos por persona» de aios-tower, CA-23). Pide «ver» en Consumo (`route-table.ts`); el backend
// lo vuelve a pedir. Solo responde a un POST: el correo va en el cuerpo, nunca en la dirección.
import type { Route } from './+types/person-credits';
import type { PersonCredits } from '../../../domain/credits';
import { fromAdminApiInBackground, type ModuleErrorReason } from '../../../shared/api/admin-loader.server';

export type PersonCreditsAnswer = { email: string } & ({ ok: true; credits: PersonCredits } | { ok: false; reason: ModuleErrorReason });

export async function action({ request, context, params }: Route.ActionArgs): Promise<PersonCreditsAnswer> {
  const email = String((await request.formData()).get('email') ?? '').trim().toLowerCase();
  if (!email) return { email, ok: false, reason: 'invalid' };
  const r = await fromAdminApiInBackground({ request, context }, (api, token) => api.getPersonCredits(token, params.companyId, email));
  return r.ok ? { email, ok: true, credits: r.value } : { email, ok: false, reason: r.reason };
}
