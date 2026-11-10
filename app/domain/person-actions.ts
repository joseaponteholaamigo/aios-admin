// Las acciones del equipo de ENSŌ sobre una persona de una cuenta (spec «Borrar cuentas y destrabar
// personas», CA-9 a CA-12): restablecer su verificación en dos pasos, borrar su login o borrarla.
// Solo las hace el superadministrador, con MFA reciente; el backend lo vuelve a revisar.

export const PERSON_ACTIONS = ['reset-mfa', 'delete-login', 'delete-person'] as const;
export type PersonAction = (typeof PERSON_ACTIONS)[number];

export const isPersonAction = (value: unknown): value is PersonAction => PERSON_ACTIONS.includes(value as PersonAction);

/** Lo que pide el panel: la acción y a quién. El correo viaja en el cuerpo, nunca en la dirección (CA-8). */
export type PersonActionRequest = { action: PersonAction; email: string };

/**
 * Lo que quedó hecho. `appUnlinked` solo dice algo al restablecer: si había una app que desvincular.
 * `noticeEmail` es `null` cuando no correspondía avisar (borrar a la persona, o restablecer sin app).
 */
export type PersonActionDone = { action: PersonAction; appUnlinked: boolean | null; noticeEmail: 'sent' | 'not-sent' | null };
