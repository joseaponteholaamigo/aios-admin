// La analítica de una persona, para el diálogo «Analítica y términos» (spec «Analítica de una persona», CA-11 a CA-13).
// Ver pide «ver» en Usuarios de clientes (`route-table.ts`); dejar de compartir y volver a compartir, «editar», que se
// revisa aquí (decisión 1). El backend lo vuelve a pedir. Solo responde a un POST: el correo va en el cuerpo, nunca en
// la dirección. Lo guardado y los rechazos vuelven al diálogo.
import type { Route } from './+types/person-analytics';
import { analyticsAccessOf } from '../../../domain/person-analytics';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fail } from '../../../shared/api/admin-loader.server';
import { readAnalyticsRequest, type AnalyticsAnswer } from '../../../shared/person-analytics/person-analytics-form-data';

export async function action({ request, context, params }: Route.ActionArgs): Promise<AnalyticsAnswer> {
  const read = readAnalyticsRequest(await request.formData());
  if ('answer' in read) return read.answer;
  if (read.request.action !== 'view' && !analyticsAccessOf(context.get(teamMemberContext)).canChange) throw fail('forbidden', 403);
  // Un corte vuelve como rechazo (`unavailable`): repetir es seguro, dejar de compartir a quien ya no comparte no cambia nada.
  const outcome = await toAdminApi({ request, context }, (api, token) => api.personAnalytics(token, params.companyId, read.request));
  return outcome.ok ? { ok: true, analytics: outcome.value } : { ok: false, rejection: outcome.rejection, errors: {} };
}
