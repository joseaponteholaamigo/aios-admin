// La analítica de una persona desde el panel (spec «Analítica de una persona», CA-10 a CA-13): si comparte su uso con
// ENSŌ, la prueba de que aceptó los Términos, y dejar de compartir o volver a compartir a su pedido. Ver pide «ver» en
// Usuarios de clientes; cambiar, «editar» (decisión 1). El backend lo vuelve a revisar. Los nombres del backend se
// traducen en `app/shared/api/person-analytics-mapping.ts`: aquí no aparece ninguno.
import type { SeatStatus } from './client-users';
import { can, type TeamMember } from './permissions';

/** Lo que se le cambia a la analítica de una persona: dejar de compartir, o volver a compartir. */
export const ANALYTICS_CHANGES = ['withdraw', 'restore'] as const;
export type AnalyticsChange = (typeof ANALYTICS_CHANGES)[number];

/** Lo que se pide: verla, o cambiarla. */
export const ANALYTICS_ACTIONS = ['view', ...ANALYTICS_CHANGES] as const;
export type AnalyticsAction = (typeof ANALYTICS_ACTIONS)[number];

export const isAnalyticsAction = (value: unknown): value is AnalyticsAction => ANALYTICS_ACTIONS.includes(value as AnalyticsAction);

/** Si la persona comparte su uso, o lo retiró (la marca de su asiento). */
export type AnalyticsSharing = 'sharing' | 'withdrawn';

/** Dónde aceptó los Términos: al registrarse, o en la ventana de la app. */
export type TermsAcceptancePlace = 'signup' | 'app-window';

/** La prueba de una versión aceptada. No se modifica nunca. */
export type TermsAcceptance = {
  version: string;
  /** La hora del equipo de la persona al pulsar, o `null` si no la mandó. */
  acceptedAt: string | null;
  /** La hora del servidor cuando le llegó: la que prueba. */
  recordedAt: string | null;
  place: TermsAcceptancePlace | null;
  /** El nombre que la persona escribió al aceptar, si escribió uno. */
  declaredName: string | null;
};

export type PersonAnalytics = {
  sharing: AnalyticsSharing;
  /** La última vez que cambió su analítica, o `null` si nunca cambió. */
  changedAt: string | null;
  /** De la más vieja a la más nueva. Vacía: no hay aceptación registrada en el backend. */
  termsAcceptances: TermsAcceptance[];
  /** Solo al cambiar: `false` si ya estaba así y no se escribió nada. Al ver, `null`. */
  changed: boolean | null;
};

/** Lo que pide el panel. El correo viaja en el cuerpo, nunca en la dirección (decisión 2); sin motivo, el backend anota «desde el panel». */
export type AnalyticsRequest = { action: AnalyticsAction; email: string; reason: string | null };

/** Quién pide, en lo que decide la analítica: si la ve y si la cambia. */
export type AnalyticsAccess = { canSee: boolean; canChange: boolean };

export const analyticsAccessOf = (member: TeamMember | null | undefined): AnalyticsAccess => ({
  canSee: member ? can(member, 'clientUsers', 'view') : false,
  canChange: member ? can(member, 'clientUsers', 'edit') : false,
});

/** Lo que se ofrece cambiar: lo contrario de lo que hay. */
export const changeFor = (sharing: AnalyticsSharing): AnalyticsChange => (sharing === 'sharing' ? 'withdraw' : 'restore');

/**
 * Si el diálogo ofrece cambiarla: solo con «editar», y no a un asiento revocado, que ya no entra a ENSŌ (el backend
 * respondería `asiento-revocado`). `null`: no se ofrece ni se explica, porque quien mira no puede cambiarla.
 */
export type AnalyticsChangeOffer = 'offered' | 'seat-revoked' | null;

export function analyticsChangeOffer(access: AnalyticsAccess, status: SeatStatus): AnalyticsChangeOffer {
  if (!access.canChange) return null;
  return status === 'revoked' ? 'seat-revoked' : 'offered';
}
