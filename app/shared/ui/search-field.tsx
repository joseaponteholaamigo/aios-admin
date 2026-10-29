// El buscador de una lista, como el del panel viejo: el ícono y el campo, sin bordes propios.
//
// Para un correo va `inputMode="email"` (el teclado del teléfono) y no `type="email"`: el navegador
// impondría su propia regla, más estricta que la del backend, y no dejaría buscar un correo raro
// que el backend sí guardó.
import { Icon } from '../icons/icon';
import './search-field.css';

/** `errorId`: el id del mensaje que explica por qué lo escrito no sirve. Lo marca inválido y lo enlaza. */
type Props = { name: string; label: string; placeholder: string; defaultValue?: string; inputMode?: 'search' | 'email'; errorId?: string };

export function SearchField({ name, label, placeholder, defaultValue, inputMode = 'search', errorId }: Props) {
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
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        autoComplete="off"
      />
    </label>
  );
}
