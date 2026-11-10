// El botón que manda un formulario (regla «Front-end interaction» del CLAUDE.md global; CA-21 de la
// spec «Crear empresas e invitar personas»). Mientras el pedido está en camino queda desactivado,
// dice qué está haciendo y muestra que trabaja, con `aria-busy`. Desactivado, el navegador tampoco
// manda el formulario con Enter. No es la garantía: la del backend es la clave del formulario.
import { useNavigation } from 'react-router';
import './submit-button.css';

type NavigationLike = { state: string; formMethod?: string; formData?: FormData };

/**
 * Si hay un envío en camino, y si es de este botón. En un formulario con dos botones (crear, y
 * «borrar la cuenta personal y seguir»), los dos se bloquean, y solo el que se oprimió dice qué hace.
 */
export function submitState(navigation: NavigationLike, name?: string, value?: string): { busy: boolean; mine: boolean } {
  const busy = navigation.state !== 'idle' && navigation.formMethod?.toUpperCase() === 'POST';
  const mine = busy && (!name || navigation.formData?.get(name) === (value ?? ''));
  return { busy, mine };
}

type SubmitButtonProps = {
  label: string;
  /** Lo que dice mientras trabaja: «Creando…». */
  busyLabel: string;
  /** El nombre y el valor que viajan con el formulario, para el que tiene más de un botón. */
  name?: string;
  value?: string;
  className?: string;
  /** Desactivado aunque no haya un pedido en camino: por ejemplo, hasta que se escriba la confirmación. */
  disabled?: boolean;
};

export function SubmitButton({ label, busyLabel, name, value, className = 'btn primary', disabled = false }: SubmitButtonProps) {
  const { busy, mine } = submitState(useNavigation(), name, value);
  return (
    <button type="submit" className={`${className} submit-button`} name={name} value={value} disabled={busy || disabled} aria-busy={mine || undefined}>
      {mine && <span className="submit-button__spinner" aria-hidden="true" />}
      {mine ? busyLabel : label}
    </button>
  );
}
