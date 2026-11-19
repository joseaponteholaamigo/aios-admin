// Lo que manda el diálogo de una acción sobre una persona: la acción y el correo, en el cuerpo.
import { isPersonAction, type PersonActionRequest } from '../../domain/person-actions';

/** La acción pedida, o `null` si el formulario no trae una acción conocida y un correo. */
export function readPersonAction(form: FormData): PersonActionRequest | null {
  const action = form.get('intent');
  const email = String(form.get('email') ?? '').trim();
  return isPersonAction(action) && email.includes('@') ? { action, email } : null;
}
