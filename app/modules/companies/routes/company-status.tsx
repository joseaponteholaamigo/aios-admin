// Revocar o reactivar una cuenta entera desde los diálogos de su ficha (spec «Revocar y reactivar una cuenta», CA-12
// a CA-14). Solo el superadministrador (`route-table.ts`), y el backend lo vuelve a pedir. Solo responde a un POST: la
// vista previa vuelve al diálogo; guardar vuelve a la ficha con el aviso; un rechazo se queda en el diálogo.
import { redirect } from 'react-router';
import type { Route } from './+types/company-status';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { readStatusChange, type StatusAnswer } from '../account-status-form-data';
import { statusChangedNoticeParams } from '../account-status-labels';

export async function action({ request, context, params }: Route.ActionArgs): Promise<StatusAnswer | Response> {
  const read = readStatusChange(await request.formData());
  if ('answer' in read) return read.answer;
  // Un corte vuelve como rechazo (`unavailable`): repetir es seguro, revocar una revocada no cambia nada.
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeAccountStatus(token, params.companyId, read.change));
  if (!outcome.ok) return { ok: false, rejection: outcome.rejection, errors: {} };
  if (read.change.previewOnly) return { ok: true, preview: outcome.value };
  return redirect(`/companies/${encodeURIComponent(params.companyId)}?${statusChangedNoticeParams(outcome.value)}`);
}
