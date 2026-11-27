// Lo que dice «Analítica y términos» (spec «Analítica de una persona», CA-10 a CA-13): el menú, si la persona comparte
// su uso, la prueba de cada versión aceptada, qué hace cada cambio, el recordatorio de lo que no se borra, lo que queda
// al guardar y los rechazos en su contexto. Puras: las prueba `tests/person-analytics.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import type { AnalyticsChange, PersonAnalytics, TermsAcceptancePlace } from '../../domain/person-analytics';
import { formatDateTime } from '../ui/format';

/** Lo que dice el menú de la persona y el botón de la ficha de una cuenta personal (CA-10). */
export const ANALYTICS_MENU_LABEL = 'Analítica y términos';

export const analyticsDialogTitle = (email: string) => `Analítica y términos de ${email}`;

/** Lo primero que dice el diálogo: de qué se trata, para quien atiende el pedido. */
export const ANALYTICS_INTRO =
  'ENSŌ comparte los errores y el uso de la app según los Términos y la Política que la persona aceptó. Dejar de compartir es su derecho a revocar esa autorización, y se hace a su pedido.';

export const ANALYTICS_LOADING = 'Leyendo su analítica y sus términos…';

/** Si comparte su uso, y desde cuándo si se sabe (CA-11). */
export function sharingStatusText({ sharing, changedAt }: Pick<PersonAnalytics, 'sharing' | 'changedAt'>): string {
  if (sharing === 'withdrawn') return changedAt ? `No comparte su uso desde el ${formatDateTime(changedAt)}.` : 'No comparte su uso.';
  return changedAt ? `Comparte su uso: volvió a compartirlo el ${formatDateTime(changedAt)}.` : 'Comparte su uso.';
}

export const TERMS_HEADING = 'Aceptación de los Términos y la Política';

const PLACE_LABELS: Record<TermsAcceptancePlace, string> = { signup: 'en el registro', 'app-window': 'en la ventana de la app' };

/** Dónde la aceptó, o `—` si la prueba no lo dice. */
export const termsPlaceLabel = (place: TermsAcceptancePlace | null) => (place ? PLACE_LABELS[place] : '—');

export const NO_TERMS_ACCEPTANCE = 'Sin aceptación registrada en el backend.';

/** Qué fecha es cuál: la del clic la pone el equipo de la persona; la registrada, el servidor. */
export const TERMS_HINT = 'Hora de Bogotá. La fecha del clic es la del equipo de la persona; la registrada, la del servidor cuando le llegó, que es la que prueba.';

/** El botón de cada cambio, lo que dice mientras guarda y qué pasa al hacerlo (CA-12). */
export const ANALYTICS_CHANGE_TEXTS: Record<AnalyticsChange, { button: string; busy: string; explanation: string }> = {
  withdraw: {
    button: 'Dejar de compartir', busy: 'Dejando de compartir…',
    explanation: 'Su ENSŌ deja de enviar sus errores y su uso en la próxima sincronización. Hazlo solo si la persona lo pidió.',
  },
  restore: {
    button: 'Volver a compartir', busy: 'Volviendo a compartir…',
    explanation: 'Su ENSŌ vuelve a enviar sus errores y su uso desde la próxima sincronización. Hazlo solo si la persona lo pidió.',
  },
};

/** Lo que dejar de compartir no hace, y cómo se borra lo ya enviado si la persona lo pidió (decisión 6). */
export const WITHDRAW_REMINDER =
  'Esto no borra lo que ya se envió. Si la persona pidió además borrar su historial, búscala por su correo en el proveedor de analítica y usa «Delete person and data».';

export const REASON_HINT = 'Queda en la auditoría del equipo. Ante el cliente firma «equipo-enso».';

/** Por qué quien puede cambiarla no ve el botón: el asiento está revocado. */
export const SEAT_REVOKED_NOTE = 'Tiene el acceso revocado: ya no entra a ENSŌ con esta cuenta, y su analítica no se cambia desde aquí.';

/** Lo que dice el diálogo después de guardar (CA-13). Sin cambio, que ya estaba así. */
export function analyticsDoneText({ sharing, changed }: Pick<PersonAnalytics, 'sharing' | 'changed'>): string {
  if (sharing === 'withdrawn') {
    return changed === false ? 'Ya no compartía su uso: no cambió nada.' : 'Listo: ya no comparte su uso. Su ENSŌ deja de enviar en la próxima sincronización.';
  }
  return changed === false ? 'Ya compartía su uso: no cambió nada.' : 'Listo: vuelve a compartir su uso desde la próxima sincronización de su ENSŌ.';
}

/** En qué momento llegó un rechazo: al abrir el diálogo, o al guardar. */
export type AnalyticsStep = 'view' | 'change';

/**
 * Un rechazo dicho para este diálogo, o `undefined` si el texto general ya sirve. Repetir un cambio es seguro: dejar
 * de compartir a quien ya no comparte no cambia nada.
 */
export function analyticsRejectionMessage(rejection: WriteRejection, step: AnalyticsStep): string | undefined {
  switch (rejection.code) {
    case 'not-found': return 'Esta persona ya no tiene asiento en esta cuenta: puede que ya se haya borrado. Recarga la página para ver cómo quedó.';
    case 'seat-revoked': return 'Esta persona tiene el acceso revocado: ya no entra a ENSŌ con esta cuenta, y su analítica no se cambia.';
    case 'unavailable':
      return step === 'view'
        ? 'La API no respondió y no se pudo leer su analítica: cierra el diálogo y vuelve a abrirlo.'
        : 'La API no respondió a tiempo y no sabemos si se guardó. Vuelve a oprimir el botón: si ya se hizo, no cambia nada.';
    default: return undefined;
  }
}
