// Lo que dice la tarjeta «Servicios de ENSŌ en revisión» y sus diálogos (spec «Reanudar la casa de una cuenta», CA-10
// a CA-14): la pausa y su motivo, los lotes congelados, qué hace y qué no hace cada paso, los rechazos en su contexto y
// el aviso al volver a la ficha. Puras: las prueba `tests/house-review.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import { causeOfLot, type FrozenLot, type HouseAction, type HousePause, type HouseReview, type HouseTarget, type PauseCause } from '../../domain/house';
import { formatCount, formatDate, formatDateTime } from '../../shared/ui/format';

export const HOUSE_CARD = {
  title: 'Servicios de ENSŌ en revisión',
  lead: 'Lo que un reembolso o una disputa de Stripe dejó en pausa o congelado. Quitar la pausa y descongelar son dos pasos separados.',
  unreadable: 'No se pudo leer ahora si esta cuenta tiene servicios de ENSŌ en revisión. Recarga la página para volver a intentarlo.',
} as const;

const CAUSE_TEXT: Record<PauseCause, string> = { refund: 'un reembolso', dispute: 'una disputa' };

/** Desde cuándo y por qué está en pausa (CA-11). Un motivo que el panel no conoce no se adivina. */
export function pauseStatusText({ since, cause }: Pick<HousePause, 'since' | 'cause'>): string {
  const why = `por ${cause ? CAUSE_TEXT[cause] : 'un aviso'} de Stripe`;
  return since ? `En pausa desde el ${formatDateTime(since)}, ${why}.` : `En pausa ${why}.`;
}

/** Qué significa la pausa para la cuenta (CA-11). */
export const PAUSE_MEANING = 'Mientras tanto, esta cuenta no puede usar los servicios que paga ENSŌ, como el video con IA y Contactos.';

/** Lo que dice la tarjeta cuando solo quedan lotes congelados: la pausa ya se quitó. */
export const NO_PAUSE = 'La cuenta no está en pausa: ya puede usar los servicios que paga ENSŌ.';

export const STRIPE_EVENT_LABEL = 'Aviso de Stripe';

export const FROZEN_HEADING = 'Créditos congelados';
export const FROZEN_LEAD = 'Lo que quedaba de los créditos de un pago revertido. No se puede gastar hasta que se descongele; lo ya gastado no se recupera.';

export const lotName = (lot: Pick<FrozenLot, 'name'>) => lot.name ?? 'Lote sin nombre';

/** Lo que queda congelado de lo que tenía el lote (CA-12): `300 de 500`. */
export const frozenCreditsText = ({ balance, credits }: Pick<FrozenLot, 'balance' | 'credits'>) => `${formatCount(balance)} de ${formatCount(credits)}`;

/** Cuándo vence el lote, o `null` si el backend no lo dice. */
export const lotExpiryText = ({ expiresAt }: Pick<FrozenLot, 'expiresAt'>) => (expiresAt ? `vence el ${formatDate(expiresAt)}` : null);

/** El botón de cada paso, lo que dice mientras guarda y el ejemplo del motivo. */
export const HOUSE_ACTION_TEXTS: Record<HouseAction, { button: string; busy: string; placeholder: string }> = {
  'lift-pause': { button: 'Quitar la pausa', busy: 'Quitando la pausa…', placeholder: 'Ej: Stripe cerró la revisión del reembolso' },
  unfreeze: { button: 'Descongelar', busy: 'Descongelando…', placeholder: 'Ej: se ganó la disputa en Stripe el 27 de noviembre' },
};

/** El nombre del botón para un lector de pantalla: en la tabla hay un «Descongelar» por fila. */
export const houseActionLabel = (target: HouseTarget) =>
  (target.action === 'unfreeze' ? `Descongelar «${lotName(target.lot)}» de ${target.lot.email}` : undefined);

export const REASON_HINT = 'Queda en la auditoría del equipo. Ante el cliente firma «equipo-enso».';

/** Una frase del diálogo. `warn`: lo que evita el paso equivocado, a la vista. */
export type HouseFact = { text: string; tone: 'plain' | 'warn' };
export type HouseDialogTexts = { title: string; intro: string; facts: HouseFact[] };

function frozenStayNote(count: number): string {
  if (count === 0) return 'Quitar la pausa no descongela créditos.';
  if (count === 1) return 'El lote congelado sigue congelado: quitar la pausa no lo descongela. Descongelarlo es aparte, y solo si la plata volvió.';
  return `Los ${count} lotes congelados siguen congelados: quitar la pausa no los descongela. Descongelarlos es aparte, lote por lote, y solo si la plata volvió.`;
}

/** Lo que dice «Quitar la pausa» (CA-13): devuelve los servicios, la cuenta sigue con sus otros créditos, los congelados siguen congelados. */
function liftPauseTexts(house: HouseReview, companyTitle: string): HouseDialogTexts {
  return {
    title: `¿Quitar la pausa de ${companyTitle}?`,
    intro: 'La cuenta vuelve a usar los servicios que paga ENSŌ, como el video con IA y Contactos, desde su próximo pedido.',
    facts: [
      { text: 'Sus personas siguen con sus otros créditos: la bolsa del mes y los lotes que no están congelados.', tone: 'plain' },
      { text: frozenStayNote(house.frozenLots.length), tone: 'warn' },
    ],
  };
}

/** La regla de descongelar (decisión 1): siempre a la vista, porque el backend no dice por lote si fue reembolso o disputa. */
export const UNFREEZE_RULE =
  'Descongela solo si la plata volvió: se ganó la disputa en Stripe. Tras un reembolso, deja el lote congelado: esa plata ya se le devolvió al cliente.';

const LOT_CAUSE_NOTES: Record<PauseCause, string> = {
  refund: 'Este lote se congeló con el mismo aviso de Stripe que pausó la cuenta por un reembolso: lo que corresponde es dejarlo congelado.',
  dispute: 'Este lote se congeló con el mismo aviso de Stripe que pausó la cuenta por una disputa: descongélalo solo si Stripe ya la dio por ganada.',
};

const creditsLeft = (balance: number) =>
  (balance === 1 ? 'El crédito que queda de este lote se puede gastar otra vez.' : `Los ${formatCount(balance)} créditos que quedan de este lote se pueden gastar otra vez.`);

/** Lo que dice «Descongelar» (CA-13): solo si la plata volvió; tras un reembolso, el lote se deja congelado; no quita la pausa. */
function unfreezeTexts(lot: FrozenLot, pause: HousePause | null): HouseDialogTexts {
  const cause = causeOfLot(lot, pause);
  return {
    title: lot.name ? `¿Descongelar «${lot.name}» de ${lot.email}?` : `¿Descongelar el lote de ${lot.email}?`,
    intro: creditsLeft(lot.balance),
    facts: [
      { text: UNFREEZE_RULE, tone: 'warn' },
      ...(cause ? [{ text: LOT_CAUSE_NOTES[cause], tone: 'warn' as const }] : []),
      ...(pause ? [{ text: 'La cuenta sigue en pausa: descongelar no la quita. Quitarla es aparte, con «Quitar la pausa».', tone: 'plain' as const }] : []),
    ],
  };
}

export const houseDialogTexts = (target: HouseTarget, house: HouseReview, companyTitle: string): HouseDialogTexts =>
  (target.action === 'lift-pause' ? liftPauseTexts(house, companyTitle) : unfreezeTexts(target.lot, house.pause));

/**
 * Un rechazo dicho para este diálogo, o `undefined` si el texto general ya sirve. Repetir es seguro: quitar una pausa
 * que ya no está, o descongelar un lote ya descongelado, no cambia nada.
 */
export function houseRejectionMessage(rejection: WriteRejection, action: HouseAction): string | undefined {
  switch (rejection.code) {
    case 'not-found':
      return action === 'unfreeze'
        ? 'Ese lote ya no es de esta persona en esta cuenta, o ya no existe: recarga la página para ver cómo quedó.'
        : 'Esta cuenta ya no existe o no está disponible: recarga la página.';
    case 'busy':
      return action === 'unfreeze'
        ? 'Los créditos de esa persona cambiaron varias veces mientras se guardaba, y no se descongeló nada: vuelve a oprimir el botón.'
        : undefined;
    case 'unavailable': return 'La API no respondió a tiempo y no sabemos si se hizo. Vuelve a oprimir el botón: si ya se hizo, no cambia nada.';
    default: return undefined;
  }
}

// El aviso al volver a la ficha: un código fijo, nunca el correo ni el lote.
const NOTICE_OF: Record<HouseAction, string> = { 'lift-pause': 'pausa-quitada', unfreeze: 'lote-descongelado' };

export function houseChangedNoticeParams({ action, changed }: { action: HouseAction; changed: boolean }) {
  return new URLSearchParams({ aviso: NOTICE_OF[action], ...(changed ? {} : { igual: '1' }) });
}

/** Qué dice la ficha al volver de quitar la pausa o descongelar, o `null` si no viene de ahí (CA-14). */
export function houseChangedNotice(params: URLSearchParams): string | null {
  const notice = params.get('aviso');
  const same = params.get('igual') === '1';
  if (notice === NOTICE_OF['lift-pause']) {
    return same
      ? 'La cuenta ya no estaba en pausa: no cambió nada.'
      : 'Pausa quitada: la cuenta ya puede usar los servicios que paga ENSŌ. Los créditos congelados siguen congelados.';
  }
  if (notice !== NOTICE_OF.unfreeze) return null;
  return same
    ? 'Ese lote ya no estaba congelado: no cambió nada.'
    : 'Lote descongelado: sus créditos vuelven a estar disponibles. Descongelar no quita la pausa: si la cuenta sigue en pausa, se gastan cuando se quite.';
}
