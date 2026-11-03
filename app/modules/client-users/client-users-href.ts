// La dirección de Usuarios de clientes: lo elegido en la lista desplegable y la página (CA-33 de M2a;
// spec «Paginación numerada», CA-8). Sin página es la primera: cambiar el filtro vuelve a ella, y la
// paginación la pide con el mismo filtro.
import { pageParam } from '../../shared/routing/page-param';
import type { CompanyChoice } from './components/client-users-filters';

export function clientUsersHref(choice: CompanyChoice, page = 1) {
  const filter: Record<string, string> = choice.kind === 'personal' ? { kind: 'personal' } : choice.kind === 'company' ? { company: choice.id } : {};
  return `?${new URLSearchParams({ ...filter, ...pageParam(page) })}`;
}
