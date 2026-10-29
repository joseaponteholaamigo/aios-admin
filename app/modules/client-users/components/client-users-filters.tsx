// La barra de filtros de Usuarios de clientes: buscar por correo y elegir una empresa, en un solo
// lugar. Cada cambio se aplica solo; el único botón es «Borrar filtros».
//
// Solo muestra y avisa: el texto, la empresa y qué pasa al cambiarlos los maneja la pantalla. No hay
// formularios: nada de esta barra puede mandar el texto en una dirección.
import { useRef } from 'react';
import type { CompanyOption } from '../../../domain/client-users';
import { Icon } from '../../../shared/icons/icon';
// Los estilos del buscador y de las barras de filtros del panel (`.adm-search`, `.filtros`).
import '../../../shared/ui/search-field.css';
import './client-users-filters.css';

/** El texto más largo que se busca: el de un correo. El backend tampoco acepta más. */
export const MAX_SEARCH_LENGTH = 254;

type Props = {
  companies: CompanyOption[];
  company: string;
  text: string;
  onTextChange: (text: string) => void;
  onCompanyChange: (companyId: string) => void;
  onClearAll: () => void;
};

export function ClientUsersFilters({ companies, company, text, onTextChange, onCompanyChange, onClearAll }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const withTeam = companies.filter((c) => c.hasTeam);
  const solo = companies.filter((c) => !c.hasTeam);
  const unknown = company !== '' && !companies.some((c) => c.id === company);
  const clearText = () => {
    onTextChange('');
    input.current?.focus();
  };
  return (
    <div className="filtros client-users-filters" role="search" aria-label="Filtrar las personas">
      <label className="adm-search client-users-filters__text">
        <Icon name="search" />
        <input
          ref={input} type="text" inputMode="email" name="text" aria-label="Buscar por correo" placeholder="Buscar por correo"
          value={text} maxLength={MAX_SEARCH_LENGTH} autoComplete="off" onChange={(e) => onTextChange(e.target.value)}
        />
        {text && (
          <button type="button" className="client-users-filters__clear" aria-label="Borrar la búsqueda" onClick={clearText}>
            <Icon name="x" />
          </button>
        )}
      </label>
      <select name="company" aria-label="Empresa" value={company} onChange={(e) => onCompanyChange(e.target.value)} className={company ? 'on' : undefined}>
        <option value="">Todas las empresas</option>
        {unknown && <option value={company}>{company}</option>}
        {withTeam.length > 0 && (
          <optgroup label={`Empresas con equipo (${withTeam.length})`}>
            {withTeam.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        )}
        {solo.length > 0 && (
          <optgroup label={`Empresas de un solo asiento (${solo.length})`}>
            {solo.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        )}
      </select>
      {(text || company) && <button type="button" className="btn sm soft" onClick={onClearAll}>Borrar filtros</button>}
    </div>
  );
}
