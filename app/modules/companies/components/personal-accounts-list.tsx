// La pestaña de cuentas personales (spec «Registro abierto» de aios-tower, CA-23 y CA-24): el buscador
// por correo, cuántas hay de cada origen, una página del índice de cuentas y el paso a la siguiente.
//
// No tiene filtro de plan: la lista por el índice no filtra por plan, y filtrar recorriendo todas las
// cuentas es justo lo que esta lista evita. La búsqueda por correo es la de siempre, y mientras tiene
// texto ocupa el lugar de la lista y de las páginas.
import type { CompaniesSearch, PersonalAccountsPage } from '../../../domain/companies';
import { Icon } from '../../../shared/icons/icon';
import { searchQuery, type SearchState } from '../../../shared/search/use-background-search';
import { SearchInput } from '../../../shared/ui/search-input';
import { personalAccountsHref } from '../companies-href';
import { emptyPersonalAccountsMessage, pageSummary } from '../personal-accounts-labels';
import { CompaniesSearchResults } from './companies-search-results';
import { CursorPager } from './cursor-pager';
import { OriginCounts } from './origin-counts';
import { PersonalAccountsTable } from './personal-accounts-table';
import './personal-accounts-list.css';

type Props = {
  /** La página que pidió el loader, con el cursor con que la pidió (`null` en la primera). */
  list: PersonalAccountsPage & { after: string | null };
  search: { text: string; setText: (text: string) => void; state: SearchState<CompaniesSearch> };
  /** El aviso de un enlace de página que no sirvió, o `null`. */
  notice: string | null;
};

export function PersonalAccountsList({ list, search, notice }: Props) {
  const { accounts, next, counts, onlySome, after } = list;
  const { state } = search;
  const paged = accounts.length > 0 || after !== null || next !== null;
  return (
    <>
      {notice && (
        <div className="banner info" role="status">
          <Icon name="info" />
          <p>{notice}</p>
        </div>
      )}
      <section className="card">
        <div className="filtros personal-accounts-list__search" role="search" aria-label="Buscar una cuenta personal">
          <SearchInput value={search.text} onChange={search.setText} inputMode="email" label="Buscar por correo" placeholder="Buscar por correo" />
        </div>
        {state.kind === 'idle' && <OriginCounts counts={counts.personal} onlySome={onlySome} />}
        <div className="card-b">
          {state.kind !== 'idle'
            ? <CompaniesSearchResults state={state} query={searchQuery(search.text)} kind="personal" plan={null} />
            : <PersonalAccountsTable accounts={accounts} emptyMessage={emptyPersonalAccountsMessage({ onlySome, after })} />}
        </div>
        {state.kind === 'idle' && paged && (
          <CursorPager
            summary={pageSummary(accounts.length)}
            firstHref={after !== null ? personalAccountsHref() : null}
            nextHref={next !== null ? personalAccountsHref(next) : null}
          />
        )}
      </section>
    </>
  );
}
