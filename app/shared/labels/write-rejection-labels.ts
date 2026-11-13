// Qué dice un formulario cuando el backend no creó o no invitó (spec «Crear empresas e invitar
// personas», CA-19 y CA-20), y junto a qué campo va.
import type { WriteRejection } from '../../domain/account-creation';
import { deletionSiteLabel } from './deletion-site-labels';
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
    case 'confirmation': return 'Lo escrito no es el id de la cuenta: escríbelo exacto para confirmar.';
    case 'account-charging': return 'La suscripción de Stripe de esta cuenta no está cancelada y puede volver a cobrar: primero hay que cancelarla en Stripe.';
    case 'deletion-in-progress': return 'Esta cuenta ya se está borrando: espera unos segundos y recarga la página.';
    case 'seats-in-use': return `Hoy tienen asiento ${rejection.used} personas: saca a las que sobran antes de bajar los asientos.`;
    case 'personal-account': return 'Una cuenta personal es de una persona: sus asientos no se cambian.';
    case 'not-custom': return 'Solo se cambian aquí los asientos de una empresa con plan Personalizado.';
    case 'busy': return 'Hay otra operación con los créditos de esa persona en curso: vuelve a oprimir el botón en unos segundos.';
    case 'code-exists': return 'Ya hay un código con ese texto (sin importar mayúsculas): elige otro.';
    case 'state-not-allowed': return 'El código cambió de estado mientras tanto: recarga la página para ver cómo quedó.';
    case 'code-busy': return 'El código está cambiando en este momento: vuelve a oprimir el botón.';
    case 'deletion-incomplete':
      return `El borrado no terminó. Falló en: ${rejection.sites.map(deletionSiteLabel).join(', ') || '—'}. Oprime «Terminar el borrado»: se termina lo que faltó.`;
    case 'already-in-team': return 'Esa persona ya está en el equipo.';
    case 'self-action': return 'Nadie actúa sobre sí mismo: pídeselo a otro superadministrador.';
    case 'invitation-accepted': return 'Ya entró con su invitación: si no puede entrar, restablece su MFA.';
    case 'conflict': return 'Otro cambio llegó primero: recarga la página y repítelo.';
    case 'pool-unavailable': return 'El login del equipo no respondió y no se creó nada: vuelve a intentarlo.';
  }
}
