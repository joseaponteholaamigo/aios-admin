// Lo que encontró la búsqueda por correo, en el lugar de la lista: cuántas personas, en qué
// empresas, y la tabla. Si hubo más de las que vinieron, pide escribir más. Lo dice en voz alta a
// quien usa un lector de pantalla, porque llega sin cambiar de página.
import type { SearchState } from '../use-people-search';
import { ClientUsersTable } from './client-users-table';
import './search-results.css';

type Props = { state: Exclude<SearchState, { kind: 'idle' }>; query: string; companyName: string | null; onlySome: boolean };

export function SearchResults({ state, query, companyName, onlySome }: Props) {
  if (state.kind === 'searching') return <p className="muted small" role="status">Buscando…</p>;
  const { people, hasMore } = state.result;
  const where = companyName ? ` de ${companyName}` : onlySome ? ' en las empresas que el panel muestra' : '';
  const count = `${people.length} persona${people.length === 1 ? '' : 's'}`;
  return (
    <div className="search-results">
      <p className="muted small" role="status">
        {people.length === 0 ? `Nadie${where} tiene un correo que contenga «${query}».` : `${count} con «${query}» en el correo${where}.`}
        {hasMore && ` Se muestran las primeras ${people.length}: escribe más para acotar.`}
      </p>
      {people.length > 0 && <ClientUsersTable people={people} emptyMessage="" />}
    </div>
  );
}
