// La casa de una cuenta desde su ficha (spec «Reanudar la casa de una cuenta», CA-10 a CA-14). La casa son los
// servicios que paga ENSŌ y que la app usa a través del backend (el video con IA y Contactos). Cuando Stripe avisa un
// reembolso o una disputa, el backend pausa esos servicios en la cuenta y congela lo que quedaba de los créditos de ese
// pago. Deshacerlo son dos pasos separados (decisión 1): quitar la pausa, y descongelar un lote. Solo el
// superadministrador (decisión 2); el backend lo vuelve a revisar. Los nombres del backend se traducen en
// `app/shared/api/house-mapping.ts`: aquí no aparece ninguno.

/** Por qué Stripe pausó la cuenta. */
export type PauseCause = 'refund' | 'dispute';

/** La pausa de la cuenta. Lo que el backend no trae queda en `null`: no se inventa. */
export type HousePause = {
  since: string | null;
  /** `null`: un motivo que el panel no conoce. La pausa se muestra igual, sin decir por qué. */
  cause: PauseCause | null;
  /** El id del aviso de Stripe que la puso. */
  stripeEvent: string | null;
};

/** Lo que quedaba de los créditos de un pago revertido, de una persona con asiento en la cuenta. */
export type FrozenLot = {
  email: string;
  lotId: string;
  name: string | null;
  /** Los créditos del lote al comprarlo. */
  credits: number;
  /** Los que quedan congelados: lo ya gastado no se recupera. */
  balance: number;
  expiresAt: string | null;
  frozenAt: string | null;
  /** El id del aviso de Stripe que lo congeló. */
  stripeEvent: string | null;
};

/** La casa de la cuenta: su pausa (o `null`) y sus lotes congelados, del más viejo al más nuevo. */
export type HouseReview = { pause: HousePause | null; frozenLots: FrozenLot[] };

/** Lo que se le hace a la casa: quitar la pausa, o descongelar un lote. */
export const HOUSE_ACTIONS = ['lift-pause', 'unfreeze'] as const;
export type HouseAction = (typeof HOUSE_ACTIONS)[number];

export const isHouseAction = (value: unknown): value is HouseAction => HOUSE_ACTIONS.includes(value as HouseAction);

/**
 * Lo que pide el panel. Descongelar lleva el correo de la persona y el id del lote, que viajan en el cuerpo y nunca en
 * una dirección. Sin motivo, el backend anota «desde el panel» (decisión 3).
 */
export type HouseChange =
  | { action: 'lift-pause'; reason: string | null }
  | { action: 'unfreeze'; email: string; lotId: string; reason: string | null };

/** Lo que responde un cambio: la casa ya cambiada y si cambió algo (`false`: ya estaba así, y no se escribió nada). */
export type HouseChangeResult = { house: HouseReview; changed: boolean };

/** Sobre qué se abre el diálogo: la pausa de la cuenta, o uno de sus lotes congelados. */
export type HouseTarget = { action: 'lift-pause' } | { action: 'unfreeze'; lot: FrozenLot };

/** ¿Hay algo que revisar? Puede haber pausa sin lotes (un reembolso de Pro) y lotes sin pausa (ya se quitó). */
export const needsReview = ({ pause, frozenLots }: HouseReview) => pause !== null || frozenLots.length > 0;

/**
 * Por qué se congeló un lote, cuando se sabe: el backend no lo dice por lote, pero si lo congeló el mismo aviso de
 * Stripe que pausó la cuenta, es el motivo de la pausa. Si no, `null`.
 */
export function causeOfLot(lot: FrozenLot, pause: HousePause | null): PauseCause | null {
  if (!pause || !lot.stripeEvent || lot.stripeEvent !== pause.stripeEvent) return null;
  return pause.cause;
}
