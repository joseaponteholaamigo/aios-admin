// Cargar créditos a una persona desde el diálogo de «Créditos» (spec «Créditos por persona» de
// aios-tower, CA-21, CA-22 y CB-11). Pide «editar» en Empresas (`route-table.ts`): el paquete de una
// empresa es parte de lo que se acordó con ella, y se paga por factura. Solo responde a un POST.
import type { Route } from './+types/person-credits-load';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import type { CreditLoadAnswer } from '../../../shared/credits/credit-answers';
import { readCreditLoad } from '../../../shared/credits/credit-load-form-data';

export async function action({ request, context, params }: Route.ActionArgs): Promise<CreditLoadAnswer> {
  const read = readCreditLoad(await request.formData());
  if ('errors' in read) return { ok: false, errors: read.errors, rejection: null };
  // Un corte vuelve como rechazo (`unavailable`): reintentar con la misma clave no carga dos veces (CA-22).
  const outcome = await toAdminApi({ request, context }, (api, token) => api.loadCredits(token, params.companyId, read.load));
  return outcome.ok ? { ok: true, loaded: outcome.value } : { ok: false, errors: {}, rejection: outcome.rejection };
}
