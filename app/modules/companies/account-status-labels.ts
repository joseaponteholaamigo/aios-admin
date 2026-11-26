// Lo que dicen «Revocar cuenta» y «Reactivar cuenta» (spec «Revocar y reactivar una cuenta», CA-11 a CA-15): el
// nombre de cada estado, por qué no se ofrece revocar, qué pasa en cada diálogo, los rechazos en su contexto, el aviso
// al volver a la ficha y cómo se llaman sus eventos en la historia. Puras: las prueba `tests/account-status.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import type { AccountStatusAction, AccountStatusResult, StatusChangeBlock } from '../../domain/account-status';
import type { HistoryEventKind } from '../../domain/companies';

/**
 * Cómo se nombra cada estado del backend. Los que terminan una suscripción bajan la cuenta a Free. En un `Map`: el
 * estado del aviso llega en la dirección, y un objeto respondería también a `constructor` o `toString`.
 */
const STATUS_NAMES = new Map<string, string>([
  ['active', 'Activa'],
  ['trialing', 'En prueba'],
  ['past_due', 'Con el pago atrasado (Stripe reintenta el cobro)'],
  ['incomplete', 'Sin pagar'],
  ['canceled', 'Vencida (recibe Free)'],
  ['unpaid', 'Vencida por falta de pago (recibe Free)'],
  ['incomplete_expired', 'Vencida sin el primer pago (recibe Free)'],
  ['paused', 'En pausa en Stripe (recibe Free)'],
  ['revoked', 'Revocada'],
]);

/** El estado en palabras. Uno que el panel no conoce se muestra tal cual: esconderlo diría menos de lo que pasa. */
export const accountStatusName = (status: string | null) => (status ? STATUS_NAMES.get(status) ?? status : 'sin estado');

/** El botón de la ficha, el del diálogo y lo que dice mientras trabaja. */
export const STATUS_ACTION_TEXTS: Record<AccountStatusAction, { button: string; busy: string; title: (account: string) => string }> = {
  revoke: { button: 'Revocar cuenta', busy: 'Revocando…', title: (account) => `¿Revocar ${account}?` },
  reactivate: { button: 'Reactivar cuenta', busy: 'Reactivando…', title: (account) => `¿Reactivar ${account}?` },
};

/** Por qué «Revocar cuenta» está desactivado, a la vista junto al botón (CA-12). */
export const STATUS_BLOCK_REASONS: Record<StatusChangeBlock, string> = {
  charging: 'Tiene una suscripción de Stripe que cobra o puede volver a cobrar: primero hay que cancelarla en Stripe. Revocada, el backend no aplicaría los avisos de Stripe y seguiría cobrando sin acceso.',
};

/** Lo primero que dice cada diálogo. */
export const STATUS_INTROS: Record<AccountStatusAction, string> = {
  revoke: 'Le corta todo a la cuenta, a propósito. No es vencer: ningún aviso de Stripe la vuelve a activar.',
  reactivate: 'Le devuelve a la cuenta el estado que tenía justo antes de revocarla.',
};

/** Lo que revocar le corta a la cuenta y no depende de la vista previa (CA-12). */
export const REVOKE_CUTS: readonly string[] = [
  'Nadie de la cuenta puede volver a entrar a ENSŌ.',
  'ENSŌ corta lo que ya descargaron a las 72 horas.',
];

/** Lo que revocar no le quita (CA-12): sus personas siguen atadas a ella, y lo demás vuelve al reactivar. */
export const REVOKE_KEEPS: readonly string[] = [
  'Las personas siguen atadas a esta cuenta: no quedan libres para entrar a otra empresa. Para liberarlas hay que borrar la cuenta.',
  'El plan, las condiciones, las reglas y los créditos no se tocan: «Reactivar cuenta» se los devuelve tal cual.',
];

/** Lo que dice el diálogo mientras llega la vista previa. */
export const STATUS_PREVIEW_LOADING: Record<AccountStatusAction, string> = {
  revoke: 'Contando a cuántas personas les corta el acceso…',
  reactivate: 'Viendo a qué estado vuelve…',
};

/** Lo que el backend dijo que pasaría, en frases (CA-12 y CA-13). Sin cambio, que no hay nada que hacer. */
export function statusPreviewLines({ action, changed, status, people }: AccountStatusResult): string[] {
  if (!changed) {
    return [action === 'revoke'
      ? 'La cuenta ya está revocada: no hay nada que hacer. Recarga la página para ver cómo quedó.'
      : 'La cuenta ya no está revocada: no hay nada que reactivar. Recarga la página para ver cómo quedó.'];
  }
  if (action === 'revoke') return [`${people} ${people === 1 ? 'persona pierde' : 'personas pierden'} el acceso.`];
  return [
    `Vuelve a «${accountStatusName(status.after)}».`,
    `${people} ${people === 1 ? 'persona recupera' : 'personas recuperan'} el acceso la próxima vez que ENSŌ sincronice.`,
    'El plan, las condiciones, las reglas y los créditos vuelven tal como estaban.',
  ];
}

/** En qué momento llegó un rechazo: al pedir la vista previa, o al guardar. */
export type StatusStep = 'preview' | 'save';

const REACTIVATE_CHARGING = 'Reactivada, volvería a un estado en que Stripe puede cobrar, y su plan guardado puede no ser el que paga: revísala en Stripe y reactívala por comando.';

/**
 * Un rechazo dicho para este diálogo, o `undefined` si el texto general ya sirve. Repetir es seguro: revocar una cuenta
 * revocada, o reactivar una que ya no lo está, no cambia nada.
 */
export function statusRejectionMessage(rejection: WriteRejection, action: AccountStatusAction, step: StatusStep): string | undefined {
  switch (rejection.code) {
    case 'account-charging': return action === 'revoke' ? STATUS_BLOCK_REASONS.charging : REACTIVATE_CHARGING;
    case 'conflict': return 'La ficha de la cuenta cambió varias veces mientras se guardaba, y no se guardó nada: vuelve a oprimir el botón.';
    case 'unavailable':
      return step === 'preview'
        ? 'La API no respondió y no se pudo ver qué pasaría: cierra el diálogo y vuelve a abrirlo.'
        : 'La API no respondió a tiempo y no sabemos si se hizo. Vuelve a oprimir el botón: si ya se hizo, no cambia nada.';
    default: return undefined;
  }
}

// El aviso al volver a la ficha: la acción y el estado de después, que no son datos de una persona.
const NOTICE_OF: Record<AccountStatusAction, string> = { revoke: 'revocada', reactivate: 'reactivada' };

export function statusChangedNoticeParams({ action, changed, status }: Pick<AccountStatusResult, 'action' | 'changed' | 'status'>) {
  const known = status.after !== null && STATUS_NAMES.has(status.after);
  return new URLSearchParams({ aviso: NOTICE_OF[action], ...(known ? { estado: status.after as string } : {}), ...(changed ? {} : { igual: '1' }) });
}

/** Qué dice la ficha al volver de revocar o reactivar, o `null` si no viene de ahí. Solo nombra estados que el panel conoce. */
export function statusChangedNotice(params: URLSearchParams): string | null {
  const notice = params.get('aviso');
  const same = params.get('igual') === '1';
  if (notice === NOTICE_OF.revoke) {
    return same ? 'La cuenta ya estaba revocada: no cambió nada.' : 'Cuenta revocada. Nadie de la cuenta puede entrar, y ENSŌ corta lo descargado a las 72 horas.';
  }
  if (notice !== NOTICE_OF.reactivate) return null;
  if (same) return 'La cuenta ya no estaba revocada: no cambió nada.';
  const name = STATUS_NAMES.get(params.get('estado') ?? '');
  return `Cuenta reactivada${name ? `: volvió a «${name}»` : ''}. Sus personas vuelven a entrar la próxima vez que ENSŌ sincronice.`;
}

/** Cómo se llaman en la historia los eventos que el panel sabe nombrar (CA-15). */
export const HISTORY_EVENT_LABELS: Record<HistoryEventKind, string> = {
  'account-revoked': 'Cuenta revocada',
  'account-reactivated': 'Cuenta reactivada',
};
