// Lo que dicen las acciones sobre una persona (spec «Borrar cuentas y destrabar personas», CA-9 a
// CA-12, y spec «Editar cuentas y personas», CA-24 a CA-26): el menú, el diálogo de confirmación, el
// aviso al terminar y el rechazo que en este contexto dice otra cosa.
import type { WriteRejection } from '../../domain/account-creation';
import type { PersonAction, PersonActionDone } from '../../domain/person-actions';

/** Lo que dice cada acción en el menú de la persona. */
export const personActionMenuLabel: Record<PersonAction, string> = {
  'change-role': 'Cambiar rol',
  'resend-invitation': 'Reenviar invitación',
  'reset-mfa': 'Restablecer verificación en dos pasos',
  'delete-login': 'Borrar login',
  revoke: 'Revocar acceso',
  'delete-person': 'Borrar persona',
};

/** `danger`: el botón va en rojo, porque le quita algo a una persona real. */
type DialogTexts = { title: string; explanation: string; check: string | null; confirm: string; busy: string; danger: boolean };

/** Quien pide destrabar puede ser quien robó la contraseña: el diálogo lo recuerda antes del botón. */
const CHECK_WHO_ASKS = 'Antes de seguir, confirma que lo pide la persona o el admin de su empresa.';

/** El diálogo de cada acción. Si cambian las decisiones de las specs, cambian estos textos. */
export function personActionTexts(action: PersonAction, email: string, companyName: string): DialogTexts {
  switch (action) {
    case 'change-role': return {
      title: 'Cambiar rol',
      explanation: `Qué ve ${email} en ${companyName}: lo de un rol de la empresa, o sin rol. Una admin ve y gobierna a todo su equipo. ENSŌ lo toma la próxima vez que la persona lo abra.`,
      check: null, confirm: 'Guardar', busy: 'Guardando…', danger: false,
    };
    case 'resend-invitation': return {
      title: 'Reenviar invitación',
      explanation: `${email} recibe otra vez el correo para entrar a ${companyName}. Sale hasta tres veces, con al menos una hora entre una y otra.`,
      check: null, confirm: 'Reenviar', busy: 'Reenviando…', danger: false,
    };
    case 'reset-mfa': return {
      title: 'Restablecer verificación en dos pasos',
      explanation: `${email} va a tener que escanear un QR nuevo con su app de códigos la próxima vez que entre. Su contraseña, su empresa y su acceso no cambian. Se cierran las sesiones que tenga abiertas y le llega un correo avisando.`,
      check: CHECK_WHO_ASKS, confirm: 'Restablecer', busy: 'Restableciendo…', danger: true,
    };
    case 'delete-login': return {
      title: 'Borrar login',
      explanation: `${email} no va a poder entrar hasta que se registre otra vez con el mismo correo, con contraseña y QR nuevos. Conserva su empresa, su rol y su acceso. Se cierran las sesiones que tenga abiertas y le llega un correo avisando.`,
      check: CHECK_WHO_ASKS, confirm: 'Borrar login', busy: 'Borrando…', danger: true,
    };
    case 'revoke': return {
      title: 'Revocar acceso',
      explanation: `${email} deja de entrar a ${companyName}: su asiento queda revocado, se borran sus ajustes de acceso y se apaga su llave de la voz. No tiene vuelta directa: para devolverle el acceso hay que borrarla e invitarla otra vez.`,
      check: 'Confirma que lo pide el admin de su empresa. No le llega ningún correo.', confirm: 'Revocar acceso', busy: 'Revocando…', danger: true,
    };
    case 'delete-person': return {
      title: 'Borrar persona',
      explanation: `${email} sale de ${companyName}: se borran su login, su asiento y sus ajustes de acceso. No se puede deshacer: para que vuelva hay que invitarla de nuevo. No le llega ningún correo.`,
      check: null, confirm: 'Borrar persona', busy: 'Borrando…', danger: true,
    };
  }
}

/** Los rechazos que aquí dicen otra cosa que en un formulario de alta, sea cual sea la acción. */
const HERE: Partial<Record<WriteRejection['code'], string>> = {
  'email-in-other-company': 'El login de este correo es de otra cuenta: desde aquí no se toca.',
  // Casi siempre es que la persona ya se borró, por ejemplo al repetir tras un corte (CB-3, CB-8, CB-20).
  'not-found': 'Esta persona ya no tiene asiento en esta cuenta: puede que ya se haya borrado. Recarga la página para ver cómo quedó.',
  'personal-account': 'Una cuenta personal es de una persona, que es su admin: su rol, su acceso y su invitación no se cambian.',
  'seat-revoked': 'Esta persona tiene el acceso revocado: para devolvérselo hay que borrarla e invitarla otra vez.',
};

/** La única admin, dicho según lo que se le iba a hacer. */
const LAST_ADMIN: Partial<Record<PersonAction, string>> = {
  'change-role': 'Es la única admin de la cuenta: nombra a otra admin antes de quitarle el admin.',
  revoke: 'Es la única admin de la cuenta: nombra a otra admin antes de revocarle el acceso.',
};

/** El texto de un rechazo en este diálogo, o `undefined` para el general. */
export function personActionRejectionMessage(rejection: WriteRejection, action: PersonAction): string | undefined {
  if (rejection.code === 'last-admin') return LAST_ADMIN[action];
  return HERE[rejection.code];
}

// El aviso viaja en la dirección como un código, nunca con el correo de la persona (CA-8).
const NOTICE_PARAM = 'persona';
const NOTICES: Record<string, string> = {
  'mfa-restablecido': 'Se restableció la verificación en dos pasos. Le llegó un correo avisando que en su próximo ingreso escanea un QR nuevo.',
  'mfa-restablecido-sin-aviso': 'Se restableció la verificación en dos pasos, pero el correo de aviso no salió: avísale por otro medio que en su próximo ingreso escanea un QR nuevo.',
  'mfa-sin-app': 'No tenía app de códigos vinculada, así que no había nada que restablecer. Se cerraron sus sesiones.',
  'login-borrado': 'Se borró su login. Le llegó un correo para que cree su cuenta otra vez con el mismo correo.',
  'login-borrado-sin-aviso': 'Se borró su login, pero el correo de aviso no salió: avísale por otro medio que cree su cuenta otra vez con el mismo correo.',
  'persona-borrada': 'Se borró a la persona de la cuenta.',
  'rol-cambiado': 'Se cambió el rol. ENSŌ lo toma la próxima vez que la persona lo abra.',
  'acceso-revocado': 'Se revocó su acceso. Para devolvérselo hay que borrarla e invitarla otra vez.',
  'invitacion-reenviada': 'Se reenvió la invitación por correo.',
  'invitacion-no-salio': 'El correo de la invitación no salió, y no gastó ninguno de sus reenvíos: vuelve a intentarlo en unos minutos.',
};

/** Las acciones cuyo aviso no depende de un correo. */
const PLAIN_NOTICE: Partial<Record<PersonAction, string>> = { 'delete-person': 'persona-borrada', 'change-role': 'rol-cambiado', revoke: 'acceso-revocado' };

function noticeCode({ action, appUnlinked, noticeEmail }: PersonActionDone): string {
  const plain = PLAIN_NOTICE[action];
  if (plain) return plain;
  if (action === 'resend-invitation') return noticeEmail === 'sent' ? 'invitacion-reenviada' : 'invitacion-no-salio';
  if (action === 'reset-mfa' && appUnlinked === false) return 'mfa-sin-app';
  const base = action === 'reset-mfa' ? 'mfa-restablecido' : 'login-borrado';
  return noticeEmail === 'sent' ? base : `${base}-sin-aviso`;
}

/** Lo que la acción le pone a la dirección de la pantalla a la que vuelve al terminar (CA-11). */
export const personActionNoticeParams = (done: PersonActionDone) => new URLSearchParams({ [NOTICE_PARAM]: noticeCode(done) });

/** Qué dice la pantalla al volver de una acción, o `null` si no viene de ahí. */
export const personActionNotice = (params: URLSearchParams): string | null => NOTICES[params.get(NOTICE_PARAM) ?? ''] ?? null;
