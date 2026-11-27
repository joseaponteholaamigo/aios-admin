// La casa de la cuenta para la tarjeta «Servicios de ENSŌ en revisión» de su ficha (spec «Reanudar la casa de una
// cuenta», CA-10). Solo se pide para el superadministrador: a cualquier otro el backend le respondería 403. Un corte
// no tumba la ficha: la tarjeta dice que no se pudo leer, y el resto se muestra.
import type { RouterContextProvider } from 'react-router';
import { fromAdminApiInBackground } from '../../shared/api/admin-loader.server';
import type { HouseView } from './components/company-house-card';

type PageRequest = { request: Request; context: Readonly<RouterContextProvider> };

export async function loadHouseView(page: PageRequest, companyId: string, superadmin: boolean): Promise<HouseView> {
  if (!superadmin) return null;
  const read = await fromAdminApiInBackground(page, (api, token) => api.getCompanyHouse(token, companyId));
  return read.ok ? { ok: true, house: read.value } : { ok: false };
}
