// Lo que dicen las acciones sobre una persona (spec «Borrar cuentas y destrabar personas», CA-9 a
// CA-12): el menú, el diálogo de confirmación, el aviso al terminar y el rechazo que cambia de sentido.
import type { WriteRejection } from '../../domain/account-creation';
import type { PersonAction, PersonActionDone } from '../../domain/person-actions';

/** Lo que dice cada acción en el menú de la persona (CA-9). */
export const personActionMenuLabel: Record<PersonAction, string> = {
  'reset-mfa': 'Restablecer verificación en dos pasos',
  'delete-login': 'Borrar login',
  'delete-person': 'Borrar persona',
};

type DialogTexts = { title: string; explanation: string; check: string | null; confirm: string; busy: string };

/** Quien pide destrabar puede ser quien robó la contraseña: el diálogo lo recuerda antes del botón. */
const CHECK_WHO_ASKS = 'Antes de seguir, confirma que lo pide la persona o el admin de su empresa.';

/** El diálogo de cada acción (CA-10). Si cambian las decisiones 3 o 4 de la spec, cambian estos textos. */
export function personActionTexts(action: PersonAction, email: string, companyName: string): DialogTexts {
  switch (action) {
    case 'reset-mfa': return {
      title: 'Restablecer verificación en dos pasos',
      explanation: `${email} va a tener que escanear un QR nuevo con su app de códigos la próxima vez que entre. Su contraseña, su empresa y su acceso no cambian. Se cierran las sesiones que tenga abiertas y le llega un correo avisando.`,
      check: CHECK_WHO_ASKS, confirm: 'Restablecer', busy: 'Restableciendo…',
    };
    case 'delete-login': return {
      title: 'Borrar login',
      explanation: `${email} no va a poder entrar hasta que se registre otra vez con el mismo correo, con contraseña y QR nuevos. Conserva su empresa, su rol y su acceso. Se cierran las sesiones que tenga abiertas y le llega un correo avisando.`,
      check: CHECK_WHO_ASKS, confirm: 'Borrar login', busy: 'Borrando…',
    };
    case 'delete-person': return {
      title: 'Borrar persona',
      explanation: `${email} sale de ${companyName}: se borran su login, su asiento y sus ajustes de acceso. No se puede deshacer: para que vuelva hay que invitarla de nuevo. No le llega ningún correo.`,
      check: null, confirm: 'Borrar persona', busy: 'Borrando…',
    };
  }
}

/** Los rechazos que en este contexto dicen otra cosa que en un formulario de alta (CA-12). */
const HERE: Partial<Record<WriteRejection['code'], string>> = {
  'email-in-other-company': 'El login de este correo es de otra cuenta: desde aquí no se toca.',
  // Casi siempre es que la persona ya se borró, por ejemplo al repetir tras un corte (CB-3, CB-8, CB-20).
  'not-found': 'Esta persona ya no tiene asiento en esta cuenta: puede que ya se haya borrado. Recarga la página para ver cómo quedó.',
};

/** El texto de un rechazo en esta pantalla, o `undefined` para el general. */
export const personActionRejectionMessage = (rejection: WriteRejection): string | undefined => HERE[rejection.code];

// El aviso viaja en la dirección como un código, nunca con el correo de la persona (CA-8).
const NOTICE_PARAM = 'persona';
const NOTICES: Record<string, string> = {
  'mfa-restablecido': 'Se restableció la verificación en dos pasos. Le llegó un correo avisando que en su próximo ingreso escanea un QR nuevo.',
  'mfa-restablecido-sin-aviso': 'Se restableció la verificación en dos pasos, pero el correo de aviso no salió: avísale por otro medio que en su próximo ingreso escanea un QR nuevo.',
  'mfa-sin-app': 'No tenía app de códigos vinculada, así que no había nada que restablecer. Se cerraron sus sesiones.',
  'login-borrado': 'Se borró su login. Le llegó un correo para que cree su cuenta otra vez con el mismo correo.',
  'login-borrado-sin-aviso': 'Se borró su login, pero el correo de aviso no salió: avísale por otro medio que cree su cuenta otra vez con el mismo correo.',
  'persona-borrada': 'Se borró a la persona de la cuenta.',
};

function noticeCode({ action, appUnlinked, noticeEmail }: PersonActionDone): string {
  if (action === 'delete-person') return 'persona-borrada';
  if (action === 'reset-mfa' && appUnlinked === false) return 'mfa-sin-app';
  const base = action === 'reset-mfa' ? 'mfa-restablecido' : 'login-borrado';
  return noticeEmail === 'sent' ? base : `${base}-sin-aviso`;
}

/** Lo que la acción le pone a la dirección de las personas de la cuenta al terminar (CA-11). */
export const personActionNoticeParams = (done: PersonActionDone) => new URLSearchParams({ [NOTICE_PARAM]: noticeCode(done) });

/** Qué dicen las personas de la cuenta al volver de una acción, o `null` si no vienen de ahí. */
export const personActionNotice = (params: URLSearchParams): string | null => NOTICES[params.get(NOTICE_PARAM) ?? ''] ?? null;
