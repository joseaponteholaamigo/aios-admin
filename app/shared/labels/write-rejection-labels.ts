// Qué dice un formulario cuando el backend no creó o no invitó (spec «Crear empresas e invitar
// personas», CA-19 y CA-20), y junto a qué campo va.
import type { WriteRejection } from '../../domain/account-creation';
import { formatDateTime } from '../ui/format';

/** Dónde se muestra un rechazo: junto al correo, al plan, al rol, o arriba del formulario. */
export type RejectionPlace = 'email' | 'plan' | 'role' | 'form';

export function rejectionPlace(rejection: WriteRejection): RejectionPlace {
  switch (rejection.code) {
    case 'email-in-other-company':
    case 'email-in-personal-account':
    case 'personal-account-pays':
    case 'already-has-seat':
    case 'seat-revoked':
      return 'email';
    case 'plan-rejected':
      return 'plan';
    case 'unknown-role':
      return 'role';
    default:
      return 'form';
  }
}

const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.:]$/.test(text) ? '' : '.'}`;

export function rejectionMessage(rejection: WriteRejection): string {
  switch (rejection.code) {
    case 'invalid': return sentence(rejection.message);
    case 'plan-rejected': return 'El plan no se puede armar así:';
    case 'email-in-other-company':
      return rejection.company ? `Ese correo ya está en ${rejection.company.name} (${rejection.company.id}).` : 'Ese correo ya está en otra empresa.';
    case 'email-in-personal-account': return `Ese correo tiene una cuenta personal (${rejection.account.id}).`;
    case 'personal-account-pays': return `La cuenta personal ${rejection.account.id} paga por Stripe: primero hay que cancelar su suscripción en Stripe.`;
    case 'unknown-role':
      return rejection.roles.length ? `Ese rol no existe en la cuenta. Los que hay: ${rejection.roles.join(', ')}.` : 'La cuenta no tiene roles: invita sin rol.';
    case 'no-seats': return `La cuenta no tiene asientos libres: ocupa ${rejection.used} de ${rejection.cap ?? '—'}.`;
    case 'already-has-seat': return 'Esa persona ya tiene un asiento en esta cuenta.';
    case 'seat-revoked': return 'A esa persona se le quitó el asiento en esta cuenta: invitarla no se lo devuelve.';
    case 'seats-unknown': return 'Todavía no se sabe cuántos asientos tiene la cuenta: vuelve a intentar en unos segundos.';
    case 'daily-invite-cap':
      return rejection.retryAt
        ? `La cuenta ya mandó hoy todas las invitaciones de su tope diario. Se puede volver a invitar desde el ${formatDateTime(rejection.retryAt)} (hora de Bogotá).`
        : 'La cuenta ya mandó hoy todas las invitaciones de su tope diario: vuelve a intentar mañana.';
    case 'key-used': return 'Este formulario ya se usó con otros datos: vuelve a abrirlo.';
    case 'key-expired': return 'Este formulario es de hace más de un día: vuelve a abrirlo.';
    case 'filter-on': return 'Con el filtro de clientes puesto, el panel no crea cuentas: no las vería.';
    case 'move-incomplete': return 'No se terminó de borrar la cuenta personal. Vuelve a intentar: el panel termina lo que faltó.';
    case 'recent-mfa': return 'Para hacer esta acción tienes que volver a ingresar tu código de verificación.';
    case 'not-found': return 'Esa cuenta no existe o no está disponible.';
    case 'in-progress': return 'Este formulario ya se está procesando: espera unos segundos y vuelve a oprimir el botón.';
    case 'unavailable': return 'La API no respondió a tiempo y no sabemos si se hizo. Vuelve a oprimir el botón: con este mismo formulario no se repite.';
    case 'no-login':
      return rejection.seat === 'invited'
        ? 'Esta persona todavía no se registró: no tiene login.'
        : 'Esta persona no tiene login: ya se borró, o nunca entró con este correo.';
    case 'last-admin': return 'Es la única admin de la cuenta: nombra a otra admin antes de borrarla.';
    case 'action-incomplete':
    case 'delete-incomplete':
      return 'No se terminó. Vuelve a oprimir el botón: se termina lo que faltó.';
  }
}
