// Revocar y reactivar una cuenta entera desde su ficha (spec «Revocar y reactivar una cuenta», CA-11 a
// CA-15). Revocar le corta todo a la cuenta, a propósito; reactivar le devuelve el estado que tenía justo
// antes. Solo el superadministrador; el backend lo vuelve a revisar. Los nombres del backend se traducen en
// `app/shared/api/account-status-mapping.ts`: aquí no aparece ninguno.

/** Lo que se le hace al estado de la cuenta. */
export const ACCOUNT_STATUS_ACTIONS = ['revoke', 'reactivate'] as const;
export type AccountStatusAction = (typeof ACCOUNT_STATUS_ACTIONS)[number];

export const isAccountStatusAction = (value: unknown): value is AccountStatusAction =>
  ACCOUNT_STATUS_ACTIONS.includes(value as AccountStatusAction);

/** El estado de una cuenta revocada, tal como lo guarda el backend. */
export const REVOKED_STATUS = 'revoked';

/**
 * Lo que pide el panel. `previewOnly`: solo ver qué pasaría (sin motivo ni confirmación). Al guardar, el motivo es
 * obligatorio y revocar lleva el id escrito a mano (`confirmation`); reactivar no pide escribirlo (decisión 3).
 */
export type AccountStatusChange = { action: AccountStatusAction; reason: string | null; confirmation: string | null; previewOnly: boolean };

export type AccountStatusResult = {
  action: AccountStatusAction;
  previewOnly: boolean;
  /** `false`: la cuenta ya estaba en ese estado, y no se escribió nada. */
  changed: boolean;
  /** El estado de antes y el de después, como los guarda el backend (`active`, `revoked`, `canceled`…). */
  status: { before: string | null; after: string | null };
  /** Cuántas personas pierden el acceso (revocar) o lo recuperan (reactivar). Sin correos. */
  people: number;
};

/** Por qué «Revocar cuenta» no se ofrece: una suscripción de Stripe que cobra o puede volver a cobrar (decisión 4). */
export type StatusChangeBlock = 'charging';

/** Lo que la ficha ofrece: revocar una cuenta que no lo está, o reactivar una revocada en su lugar (CA-11). */
export type AccountStatusOffer = { action: AccountStatusAction; blocked: StatusChangeBlock | null };

/**
 * Qué se ofrece según el estado de la cuenta. Revocada, el backend ignora los avisos de Stripe: una suscripción que
 * cobra seguiría cobrando sin acceso, así que no se revoca. Si reactivar dejaría a Stripe cobrando (decisión 6) solo
 * lo sabe el backend, con el estado que recuperaría: lo dice su vista previa.
 */
export function accountStatusOffer({ status, stripeCanCharge }: { status: string | null; stripeCanCharge: boolean }): AccountStatusOffer {
  if (status === REVOKED_STATUS) return { action: 'reactivate', blocked: null };
  return { action: 'revoke', blocked: stripeCanCharge ? 'charging' : null };
}
