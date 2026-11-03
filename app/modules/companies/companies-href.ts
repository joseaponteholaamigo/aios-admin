// La dirección de Empresas: la pestaña, el plan y la página (spec «Cuentas personales», CA-18 y
// CA-20; spec «Paginación numerada», CA-8). Sin página es la primera: cambiar de pestaña o de plan
// vuelve a ella, y la paginación la pide con los mismos filtros.
import type { AccountKind, ListPlan } from '../../domain/companies';
import { pageParam } from '../../shared/routing/page-param';

export function companiesHref({ kind, plan }: { kind: AccountKind; plan: ListPlan | null }, page = 1) {
  const params = { ...(kind === 'personal' ? { kind } : {}), ...(plan ? { plan } : {}), ...pageParam(page) };
  return `/companies?${new URLSearchParams(params)}`;
}
