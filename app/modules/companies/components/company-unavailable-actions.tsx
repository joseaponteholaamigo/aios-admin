// Por qué un botón de la ficha está desactivado, a la vista (spec «Editar cuentas y personas», CA-27; spec «Revocar y
// reactivar una cuenta», CA-12): un solo aviso, con una línea por botón. Cada línea lleva el id al que apunta su botón.
import { Icon } from '../../../shared/icons/icon';

export type UnavailableAction = { id: string; text: string };

export function CompanyUnavailableActions({ actions }: { actions: UnavailableAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="banner info" role="note">
      <Icon name="info" />
      <div>{actions.map((a) => <p key={a.id} id={a.id}>{a.text}</p>)}</div>
    </div>
  );
}
