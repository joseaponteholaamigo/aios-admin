// Pasar una empresa a cuenta personal, o al revés, desde el diálogo de su ficha (spec «Pasar una empresa a cuenta
// personal, y al revés», CA-12 a CA-14). Solo el superadministrador (`route-table.ts`), y el backend lo vuelve a pedir.
// Solo responde a un POST: la vista previa vuelve al diálogo; guardar vuelve a la ficha con el aviso; un rechazo se
// queda en el diálogo.
import { redirect } from 'react-router';
import type { Route } from './+types/company-type';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { readTypeChange, type TypeAnswer } from '../account-type-form-data';
import { typeChangedNoticeParams } from '../account-type-labels';

export async function action({ request, context, params }: Route.ActionArgs): Promise<TypeAnswer | Response> {
  const read = readTypeChange(await request.formData());
  if ('answer' in read) return read.answer;
  // Un corte vuelve como rechazo (`unavailable`): repetir es seguro, pasar la cuenta al tipo que ya tiene no cambia nada.
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeAccountType(token, params.companyId, read.change));
  if (!outcome.ok) return { ok: false, rejection: outcome.rejection, errors: {} };
  if (read.change.previewOnly) return { ok: true, preview: outcome.value };
  return redirect(`/companies/${encodeURIComponent(params.companyId)}?${typeChangedNoticeParams(outcome.value)}`);
}
