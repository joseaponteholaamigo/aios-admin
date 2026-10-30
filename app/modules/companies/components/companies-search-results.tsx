// Lo que encontró la búsqueda de Empresas, en el lugar de la lista: cuántas cuentas, con qué texto y
// la tabla de esa pestaña. Si hubo más de las que vinieron, pide escribir más. Lo dice en voz alta a
// quien usa un lector de pantalla, porque llega sin cambiar de página.
import type { AccountKind, CompaniesSearch, ListPlan } from '../../../domain/companies';
import type { SearchState } from '../../../shared/search/use-background-search';
import { searchSummary } from '../company-labels';
import { CompaniesTable } from './companies-table';
import { PersonalAccountsTable } from './personal-accounts-table';
import './companies-search-results.css';

type Props = { state: Exclude<SearchState<CompaniesSearch>, { kind: 'idle' }>; query: string; kind: AccountKind; plan: ListPlan | null };

export function CompaniesSearchResults({ state, query, kind, plan }: Props) {
  if (state.kind === 'searching') return <p className="muted small" role="status">Buscando…</p>;
  const { companies, hasMore } = state.result;
  return (
    <div className="companies-search-results">
      <p className="muted small" role="status">{searchSummary(kind, query, plan, { count: companies.length, hasMore })}</p>
      {companies.length > 0 && (kind === 'personal'
        ? <PersonalAccountsTable accounts={companies} emptyMessage="" />
        : <CompaniesTable companies={companies} emptyMessage="" />)}
    </div>
  );
}
