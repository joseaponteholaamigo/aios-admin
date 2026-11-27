// Quitar la pausa de la casa de una cuenta, o descongelar uno de sus lotes, desde los diálogos de su ficha (spec
// «Reanudar la casa de una cuenta», CA-13 y CA-14). Solo el superadministrador (`route-table.ts`), y el backend lo
// vuelve a pedir. Solo responde a un POST, con el correo en el cuerpo: guardar vuelve a la ficha con el aviso; un
// rechazo se queda en el diálogo.
import { redirect } from 'react-router';
import type { Route } from './+types/company-house';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { readHouseChange, type HouseAnswer } from '../house-form-data';
import { houseChangedNoticeParams } from '../house-labels';

export async function action({ request, context, params }: Route.ActionArgs): Promise<HouseAnswer | Response> {
  const read = readHouseChange(await request.formData());
  if ('answer' in read) return read.answer;
  // Un corte vuelve como rechazo (`unavailable`): repetir es seguro, quitar una pausa que ya no está no cambia nada.
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeHouse(token, params.companyId, read.change));
  if (!outcome.ok) return { ok: false, rejection: outcome.rejection, errors: {} };
  const notice = houseChangedNoticeParams({ action: read.change.action, changed: outcome.value.changed });
  return redirect(`/companies/${encodeURIComponent(params.companyId)}?${notice}`);
}
