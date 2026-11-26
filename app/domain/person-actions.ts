// Las acciones del equipo de ENSŌ sobre una persona de una cuenta (spec «Borrar cuentas y destrabar
// personas», CA-9 a CA-12): restablecer su verificación en dos pasos, borrar su login o borrarla.
// Solo las hace el superadministrador; el backend lo vuelve a revisar.

export const PERSON_ACTIONS = ['reset-mfa', 'delete-login', 'delete-person'] as const;
export type PersonAction = (typeof PERSON_ACTIONS)[number];

/**
 * Lo que se le hace a la persona de una cuenta personal: todo menos borrarla, porque es la única (CB-4); se
 * borra la cuenta. Lo ofrecen sus personas y su ficha (spec «Editar cuentas y personas», CA-1).
 */
export const PERSONAL_ACCOUNT_ACTIONS: readonly PersonAction[] = ['reset-mfa', 'delete-login'];

export const isPersonAction = (value: unknown): value is PersonAction => PERSON_ACTIONS.includes(value as PersonAction);

/** Qué acción y sobre quién: lo que abre su diálogo. */
export type PersonActionTarget = { action: PersonAction; email: string };

/** Lo que pide el panel: la acción y a quién. El correo viaja en el cuerpo, nunca en la dirección (CA-8). */
export type PersonActionRequest = PersonActionTarget;

/**
 * Lo que quedó hecho. `appUnlinked` solo dice algo al restablecer: si había una app que desvincular.
 * `noticeEmail` es `null` cuando no correspondía avisar (borrar a la persona, o restablecer sin app).
 */
export type PersonActionDone = { action: PersonAction; appUnlinked: boolean | null; noticeEmail: 'sent' | 'not-sent' | null };
