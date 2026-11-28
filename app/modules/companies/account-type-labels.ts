// Lo que dicen «Pasar a cuenta personal» y «Pasar a empresa» (spec «Pasar una empresa a cuenta personal, y al revés»,
// CA-11 a CA-14): el botón, qué cambia según la tabla «Qué cambia con el tipo», los rechazos en su contexto y el aviso
// al volver a la ficha. Los nombres de sus eventos en la historia están en `history-event-labels.ts`. Puras: las prueba
// `tests/account-type.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import type { AccountTypeResult } from '../../domain/account-type';
import type { AccountKind } from '../../domain/companies';

/** Cómo se nombra cada tipo dentro de una frase. */
const KIND_NAMES: Record<AccountKind, string> = { company: 'empresa', personal: 'cuenta personal' };

/** El botón de la ficha (según el tipo al que pasa), el título del diálogo y lo que dice mientras llega la vista previa. */
export const TYPE_ACTION_TEXTS: Record<AccountKind, { button: string; title: (account: string) => string; loading: string }> = {
  personal: {
    button: 'Pasar a cuenta personal',
    title: (account) => `¿Pasar ${account} a cuenta personal?`,
    loading: 'Revisando si la cuenta puede pasar a cuenta personal…',
  },
  company: {
    button: 'Pasar a empresa',
    title: (account) => `¿Pasar ${account} a empresa?`,
    loading: 'Revisando si la cuenta puede pasar a empresa…',
  },
};

/** El botón del diálogo y lo que dice mientras guarda. */
export const TYPE_SAVE_TEXTS = { button: 'Guardar', busy: 'Guardando…' } as const;

/** Lo primero que dice el diálogo: lo que no cambia, y cómo se deshace (decisión 5). */
export const TYPE_INTROS: Record<AccountKind, string> = {
  personal: 'Una cuenta personal es de una sola persona. Solo cambia el tipo: el plan, los créditos y las personas quedan como están, y nadie pierde el acceso. Se deshace con «Pasar a empresa».',
  company: 'Solo cambia el tipo: el plan, los créditos y su persona quedan como están, y nadie pierde el acceso. Se deshace con «Pasar a cuenta personal».',
};

/** Una línea de lo que cambia. `warn`: lo que puede borrar la cuenta, a la vista y no como letra chica. */
export type TypeEffect = { text: string; warn: boolean };

const line = (text: string, warn = false): TypeEffect => ({ text, warn });

/** Lo que cambia al pasar a cuenta personal: la columna «Cuenta personal» de la tabla de la spec. */
const toPersonalEffects = (who: string): TypeEffect[] => [
  line('Pasa de la pestaña «Empresas» a «Cuentas personales».'),
  line(`Sus asientos y el rol de ${who} ya no se cambian desde el panel: «Cambiar plan» solo ofrece un asiento y sin equipo.`),
  line(`En ENSŌ, con Pro, ${who} puede comprar paquetes de créditos por Stripe.`),
  line(`Si ${who} pasa a otra empresa (con «mover» desde el panel o, cuando esté habilitado, aceptando en ENSŌ la invitación de otra empresa), ${who} se va y esta cuenta se borra.`, true),
  line(`Si ${who} borra su propia cuenta, su correo espera 24 horas para abrir una nueva.`),
  line(`No se vuelve admin: ${who} queda con el rol que tiene.`),
];

/** Lo que cambia al pasar a empresa: la columna «Empresa» de la tabla de la spec. */
const toCompanyEffects = (who: string): TypeEffect[] => [
  line('Pasa de la pestaña «Cuentas personales» a «Empresas».'),
  line(`Sus asientos y el rol de ${who} se cambian desde el panel, como en cualquier empresa.`),
  line('En ENSŌ ya no compra paquetes de créditos por Stripe: los carga el superadministrador, y su admin ve los créditos de la empresa.'),
  line(`Si otra empresa invita a ${who}, no puede: el correo ya está en esta empresa. «Mover» desde el panel tampoco funciona, así que esta cuenta ya no se borra por eso.`),
  line(`Si ${who} borra su propia cuenta, su correo no espera para abrir una nueva.`),
];

/**
 * Lo que dice la vista previa (CA-12): qué cambia en ese sentido, nombrando a la persona si el backend la mandó. Si la
 * cuenta ya era de ese tipo, que no hay nada que hacer.
 */
export function typePreviewLines({ changed, kind, person }: AccountTypeResult): TypeEffect[] {
  if (!changed) return [line(`La cuenta ya es ${KIND_NAMES[kind.after]}: no hay nada que cambiar. Recarga la página para ver cómo quedó.`)];
  const who = person ?? 'su persona';
  return kind.after === 'personal' ? toPersonalEffects(who) : toCompanyEffects(who);
}

/** En qué momento llegó un rechazo: al pedir la vista previa, o al guardar. */
export type TypeStep = 'preview' | 'save';

/**
 * Un rechazo dicho para este diálogo, o `undefined` si el texto general ya sirve (`write-rejection-labels.ts`: el plan
 * de equipo, varias personas y el mover en curso ya dicen qué hacer). Repetir es seguro: pasar una cuenta al tipo que
 * ya tiene no cambia nada.
 */
export function typeRejectionMessage(rejection: WriteRejection, step: TypeStep): string | undefined {
  switch (rejection.code) {
    case 'conflict': return 'La ficha de la cuenta cambió varias veces mientras se guardaba, y no se guardó nada: vuelve a oprimir «Guardar».';
    case 'unavailable':
      return step === 'preview'
        ? 'La API no respondió y no se pudo ver qué cambia: cierra el diálogo y vuelve a abrirlo.'
        : 'La API no respondió a tiempo y no sabemos si se hizo. Vuelve a oprimir «Guardar»: si ya se hizo, no cambia nada.';
    default: return undefined;
  }
}

// El aviso al volver a la ficha: el tipo de después, que no es un dato de una persona.
const NOTICE_OF: Record<AccountKind, string> = { personal: 'a-cuenta-personal', company: 'a-empresa' };

export function typeChangedNoticeParams({ changed, kind }: Pick<AccountTypeResult, 'changed' | 'kind'>) {
  return new URLSearchParams({ aviso: NOTICE_OF[kind.after], ...(changed ? {} : { igual: '1' }) });
}

/** Qué dice la ficha al volver de cambiar el tipo, o `null` si no viene de ahí. */
export function typeChangedNotice(params: URLSearchParams): string | null {
  const notice = params.get('aviso');
  const kind = (Object.keys(NOTICE_OF) as AccountKind[]).find((k) => NOTICE_OF[k] === notice);
  if (!kind) return null;
  if (params.get('igual') === '1') return `La cuenta ya era ${KIND_NAMES[kind]}: no cambió nada.`;
  return kind === 'personal'
    ? 'La cuenta pasó a cuenta personal. Ahora está en la pestaña «Cuentas personales».'
    : 'La cuenta pasó a empresa. Ahora está en la pestaña «Empresas».';
}
