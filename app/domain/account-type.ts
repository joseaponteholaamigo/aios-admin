// Pasar una empresa a cuenta personal, y al revés, desde su ficha (spec «Pasar una empresa a cuenta personal, y al
// revés», CA-11 a CA-15). Solo el superadministrador; el backend lo vuelve a revisar. El cambio no corta el acceso a
// nadie y se deshace con el paso contrario. Los nombres del backend se traducen en
// `app/shared/api/account-type-mapping.ts`: aquí no aparece ninguno.
import type { AccountKind } from './companies';

const ACCOUNT_KINDS: readonly AccountKind[] = ['company', 'personal'];

export const isAccountKind = (value: unknown): value is AccountKind => ACCOUNT_KINDS.includes(value as AccountKind);

/**
 * Lo que pide el panel: el tipo al que pasa la cuenta. `previewOnly`: solo ver qué cambiaría (sin motivo). Al guardar,
 * el motivo es opcional (decisión 6): sin él, el backend anota «desde el panel».
 */
export type AccountTypeChange = { kind: AccountKind; reason: string | null; previewOnly: boolean };

export type AccountTypeResult = {
  previewOnly: boolean;
  /** `false`: la cuenta ya era de ese tipo, y no se escribió nada. */
  changed: boolean;
  kind: { before: AccountKind; after: AccountKind };
  /** El correo de la única persona con asiento sin revocar, o `null` si no hay una sola. */
  person: string | null;
};

/** El tipo que la ficha ofrece: el otro (CA-11). */
export const accountTypeTarget = (kind: AccountKind): AccountKind => (kind === 'personal' ? 'company' : 'personal');
