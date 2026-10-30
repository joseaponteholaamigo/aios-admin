// La barra de filtros de Usuarios de clientes: buscar por correo y elegir una empresa (o solo las
// cuentas personales), en un solo lugar. Cada cambio se aplica solo; el único botón es «Borrar
// filtros».
//
// Solo muestra y avisa: el texto, la elección y qué pasa al cambiarlos los maneja la pantalla. No
// hay formularios: nada de esta barra puede mandar el texto en una dirección.
import type { CompanyOption } from '../../../domain/client-users';
import { SearchInput } from '../../../shared/ui/search-input';
import './client-users-filters.css';

/** Qué se eligió en la lista: todas, una empresa o solo las cuentas personales. */
export type CompanyChoice = { kind: 'all' } | { kind: 'company'; id: string } | { kind: 'personal' };

/** El valor de la opción «Solo cuentas personales». No choca con un id: los ids no llevan `:`. */
const PERSONAL_VALUE = 'tipo:personal';

const valueOf = (choice: CompanyChoice) => (choice.kind === 'all' ? '' : choice.kind === 'personal' ? PERSONAL_VALUE : choice.id);
const choiceOf = (value: string): CompanyChoice => (!value ? { kind: 'all' } : value === PERSONAL_VALUE ? { kind: 'personal' } : { kind: 'company', id: value });

type Props = {
  companies: CompanyOption[];
  choice: CompanyChoice;
  text: string;
  onTextChange: (text: string) => void;
  onChoiceChange: (choice: CompanyChoice) => void;
  onClearAll: () => void;
};

export function ClientUsersFilters({ companies, choice, text, onTextChange, onChoiceChange, onClearAll }: Props) {
  const real = companies.filter((c) => c.kind === 'company');
  const personal = companies.length - real.length;
  const unknown = choice.kind === 'company' && !companies.some((c) => c.id === choice.id);
  return (
    <div className="filtros client-users-filters" role="search" aria-label="Filtrar las personas">
      <SearchInput value={text} onChange={onTextChange} label="Buscar por correo" placeholder="Buscar por correo" inputMode="email" />
      <select
        name="company" aria-label="Empresa" value={valueOf(choice)} onChange={(e) => onChoiceChange(choiceOf(e.target.value))}
        className={choice.kind === 'all' ? undefined : 'on'}
      >
        <option value="">Todas las empresas</option>
        {unknown && <option value={choice.id}>{choice.id}</option>}
        {personal > 0 && <option value={PERSONAL_VALUE}>{`Solo cuentas personales (${personal})`}</option>}
        {real.length > 0 && (
          <optgroup label={`Empresas (${real.length})`}>
            {real.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        )}
      </select>
      {(text || choice.kind !== 'all') && <button type="button" className="btn sm soft" onClick={onClearAll}>Borrar filtros</button>}
    </div>
  );
}
