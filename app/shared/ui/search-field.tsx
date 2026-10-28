// El buscador de una lista, como el del panel viejo: el ícono y el campo, sin bordes propios.
//
// Para un correo va `inputMode="email"` (el teclado del teléfono) y no `type="email"`: el navegador
// impondría su propia regla, más estricta que la del backend, y no dejaría buscar un correo raro
// que el backend sí guardó.
import { Icon } from '../icons/icon';
import './search-field.css';

type Props = { name: string; label: string; placeholder: string; defaultValue?: string; inputMode?: 'search' | 'email' };

export function SearchField({ name, label, placeholder, defaultValue, inputMode = 'search' }: Props) {
  return (
    <label className="adm-search">
      <Icon name="search" />
      <input
        type={inputMode === 'search' ? 'search' : 'text'}
        inputMode={inputMode}
        name={name}
        aria-label={label}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete="off"
      />
    </label>
  );
}
