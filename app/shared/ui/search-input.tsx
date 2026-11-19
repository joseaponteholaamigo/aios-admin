// El buscador de una barra de filtros que se aplica sola: el ícono, el campo y, con texto, una X
// para borrarlo que devuelve el foco al campo. Sin formulario: nada de aquí puede mandar el texto en
// una dirección.
//
// Para un correo va `inputMode="email"` (el teclado del teléfono) y no `type="email"`: el navegador
// impondría su propia regla, más estricta que la del backend.
import { useRef } from 'react';
import { Icon } from '../icons/icon';
import { MAX_SEARCH_LENGTH } from '../search/use-background-search';
// Los estilos del buscador y de las barras de filtros del panel (`.adm-search`, `.filtros`).
import './search-field.css';
import './search-input.css';

type Props = { value: string; onChange: (text: string) => void; label: string; placeholder: string; inputMode?: 'search' | 'email' };

export function SearchInput({ value, onChange, label, placeholder, inputMode = 'search' }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onChange('');
    input.current?.focus();
  };
  return (
    <label className="adm-search search-input">
      <Icon name="search" />
      <input
        ref={input} type="text" inputMode={inputMode} name="text" aria-label={label} placeholder={placeholder}
        value={value} maxLength={MAX_SEARCH_LENGTH} autoComplete="off" onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="search-input__clear" aria-label="Borrar la búsqueda" onClick={clear}>
          <Icon name="x" />
        </button>
      )}
    </label>
  );
}
