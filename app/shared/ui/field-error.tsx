// El error de un campo de formulario, debajo de él. Lo lee el lector de pantalla al aparecer.
import './field-error.css';

export function FieldError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <small className="field-error" role="alert">{message}</small>;
}
