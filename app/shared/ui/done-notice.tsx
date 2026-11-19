// El aviso de que algo salió bien, arriba de la pantalla a la que llevó (crear una cuenta, invitar).
import { Icon } from '../icons/icon';

export function DoneNotice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="banner info" role="status">
      <Icon name="check" />
      <p>{text}</p>
    </div>
  );
}
