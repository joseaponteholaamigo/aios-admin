// Lo que manda el diálogo de una acción sobre una persona: la acción y el correo, en el cuerpo, y lo que
// cada acción necesita (el rol nuevo, el motivo). Lo leen las personas de una cuenta y la ficha de una
// cuenta personal, cada una con las acciones que ofrece. Puro: lo prueban `tests/person-actions.test.ts`
// y `tests/person-governance.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import { PERSON_ACTIONS, isPersonAction, type PersonAction, type PersonActionRequest, type RoleChange } from '../../domain/person-actions';

/** El motivo más largo que acepta el backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;
/** Un rol es un slug corto; esto es solo una red contra un campo pegado por error, como al invitar. */
const ROLE_MAX = 64;

/** Los campos que algunas acciones mandan además del correo: el rol y el admin de «Cambiar rol» (con los de antes, para mandar solo lo que cambió) y el motivo. */
export const ACTION_FIELDS = { role: 'role', isAdmin: 'isAdmin', currentRole: 'currentRole', currentAdmin: 'currentAdmin', reason: 'reason' } as const;

/**
 * El último intento que no se hizo: vuelve a abrir su diálogo, con el porqué. `attempt: null`, un pedido que no se
 * entendió (no se sabe de qué diálogo era).
 */
export type PersonActionAttempt = { attempt: PersonActionRequest | null; rejection: WriteRejection };

/** Lo que una acción responde cuando el formulario no se entiende: no llega a la API. */
export const UNREADABLE_PERSON_ACTION: PersonActionAttempt = { attempt: null, rejection: { code: 'invalid', message: 'el pedido no se entiende' } };

const invalidAttempt = (attempt: PersonActionRequest, message: string): PersonActionAttempt => ({ attempt, rejection: { code: 'invalid', message } });

/** Solo lo que cambió: el rol, el admin o los dos. Un rol vacío es «sin rol». */
function roleChangeOf(form: FormData): RoleChange {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const [role, currentRole] = [text(ACTION_FIELDS.role) || null, text(ACTION_FIELDS.currentRole) || null];
  const [isAdmin, currentAdmin] = [form.get(ACTION_FIELDS.isAdmin) === 'on', form.get(ACTION_FIELDS.currentAdmin) === 'true'];
  return { ...(role !== currentRole ? { role } : {}), ...(isAdmin !== currentAdmin ? { isAdmin } : {}) };
}

/** El pedido de una acción ya conocida, o el intento con el porqué no se manda. */
function requestOf(action: PersonAction, email: string, form: FormData): { request: PersonActionRequest } | PersonActionAttempt {
  if (action !== 'change-role' && action !== 'revoke') return { request: { action, email } };
  const reason = String(form.get(ACTION_FIELDS.reason) ?? '').trim();
  const request: PersonActionRequest = action === 'revoke' ? { action, email, reason } : { action, email, reason, change: roleChangeOf(form) };
  if (reason.length > REASON_MAX) return invalidAttempt(request, `el motivo va hasta ${REASON_MAX} caracteres`);
  if (request.action !== 'change-role') return { request };
  if ((request.change.role?.length ?? 0) > ROLE_MAX) return invalidAttempt(request, 'ese rol no tiene forma de rol');
  if (Object.keys(request.change).length === 0) return invalidAttempt(request, 'no cambiaste nada: elige otro rol o cambia la casilla de admin');
  return { request };
}

/**
 * El pedido (`{ request }`), o el intento que vuelve al diálogo con su porqué. Una acción fuera de `allowed`, o sin
 * correo, no se entiende: una pantalla que ofrece menos acciones no acepta las demás aunque alguien las mande a mano.
 */
export function readPersonAction(form: FormData, allowed: readonly PersonAction[] = PERSON_ACTIONS): { request: PersonActionRequest } | PersonActionAttempt {
  const action = form.get('intent');
  const email = String(form.get('email') ?? '').trim();
  if (!isPersonAction(action) || !allowed.includes(action) || !email.includes('@')) return UNREADABLE_PERSON_ACTION;
  return requestOf(action, email, form);
}
