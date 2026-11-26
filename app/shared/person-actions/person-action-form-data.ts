// Lo que manda el diálogo de una acción sobre una persona: la acción y el correo, en el cuerpo. Lo leen
// las personas de una cuenta y la ficha de una cuenta personal, cada una con las acciones que ofrece.
import type { WriteRejection } from '../../domain/account-creation';
import { PERSON_ACTIONS, isPersonAction, type PersonAction, type PersonActionRequest } from '../../domain/person-actions';

/** El último intento que el backend rechazó: vuelve a abrir su diálogo, con el rechazo. `attempt: null`, un pedido que no se entendió. */
export type PersonActionAttempt = { attempt: PersonActionRequest | null; rejection: WriteRejection };

/**
 * La acción pedida, o `null` si el formulario no trae una de `allowed` y un correo. Una pantalla que ofrece
 * menos acciones no acepta las demás aunque alguien las mande a mano.
 */
export function readPersonAction(form: FormData, allowed: readonly PersonAction[] = PERSON_ACTIONS): PersonActionRequest | null {
  const action = form.get('intent');
  const email = String(form.get('email') ?? '').trim();
  return isPersonAction(action) && allowed.includes(action) && email.includes('@') ? { action, email } : null;
}

/** Lo que una acción responde cuando el formulario no se entiende: no llega a la API. */
export const UNREADABLE_PERSON_ACTION: PersonActionAttempt = { attempt: null, rejection: { code: 'invalid', message: 'el pedido no se entiende' } };
