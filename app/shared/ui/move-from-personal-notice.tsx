// El aviso de «la empresa gana» (spec «Crear empresas e invitar personas», CA-20): el correo tiene una
// cuenta personal, y seguir la borra para llevar a la persona a `destination`. El botón lo ve solo
// un superadministrador (decisión 10), y con una cuenta que paga por Stripe no hay botón.
import type { PersonalAccountRef } from '../../domain/account-creation';
import { Icon } from '../icons/icon';
import { SubmitButton } from './submit-button';

type Props = { account: PersonalAccountRef; destination: string; canMove: boolean };

/** El nombre y el valor con que viaja el botón de mover: la acción lo lee del formulario. */
export const MOVE_FIELD = 'move';
export const MOVE_VALUE = '1';

/**
 * El nombre y el valor del botón principal de un formulario que también tiene el de mover: así cada
 * uno sabe si fue el oprimido (`submitState`).
 *
 * ⛔ EL PRINCIPAL VA PRIMERO EN EL FORMULARIO. Con Enter, el navegador manda el formulario con el
 * primer botón de envío que encuentra: si el primero fuera el de mover, Enter en cualquier campo
 * borraría una cuenta personal sin que nadie oprimiera nada.
 */
export const SUBMIT_FIELD = 'intent';
export const SUBMIT_VALUE = 'submit';

export function MoveFromPersonalNotice({ account, destination, canMove }: Props) {
  if (account.paysWithStripe) {
    return (
      <div className="banner" role="alert">
        <Icon name="alert" />
        <p>La cuenta personal <span className="mono">{account.id}</span> paga por Stripe. Primero cancela su suscripción en Stripe; después la puedes traer.</p>
      </div>
    );
  }
  return (
    <div className="banner" role="alert">
      <Icon name="alert" />
      <div>
        <p>Esta persona tiene una cuenta personal (<span className="mono">{account.id}</span>). Si sigues, esa cuenta se borra y la persona pasa a {destination}.</p>
        {canMove
          ? <p><SubmitButton name={MOVE_FIELD} value={MOVE_VALUE} label="Borrar la cuenta personal y seguir" busyLabel="Moviendo…" className="btn sm" /></p>
          : <p className="small muted">Solo un superadministrador puede hacerlo.</p>}
      </div>
    </div>
  );
}
