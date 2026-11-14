// Los códigos de registro (spec «Códigos de registro», CA-1 a CA-7): lo que el panel sabe de un
// código. Sin React ni servidor: es dominio. Los nombres del backend se traducen en `shared/api/`.

/** Cómo está un código: lo que puso el equipo, o lo que dicen la hora y los usos (CA-4). */
export const CODE_STATUSES = ['active', 'paused', 'revoked', 'expired', 'exhausted', 'not-yet'] as const;
export type CodeStatus = (typeof CODE_STATUSES)[number];

/** Cuánto dura el Pro de quien canjea: N meses o N días desde el canje, hasta una fecha, o sin fin. */
export type CodeDuration =
  | { kind: 'months'; n: number }
  | { kind: 'days'; n: number }
  | { kind: 'until'; date: string }
  | { kind: 'no-end' };

export const DURATION_KINDS = ['months', 'days', 'until', 'no-end'] as const;
export type DurationKind = (typeof DURATION_KINDS)[number];

export type RegistrationCode = {
  code: string;
  label: string;
  generated: boolean;
  /** Desde y hasta cuándo se puede usar, ISO 8601. */
  from: string;
  until: string;
  /**
   * El tope de usos, o `null` sin tope: solo un código generado antes de que todo código llevara tope
   * (enmienda 7b de la spec). Esos se revocan o se pausan antes de abrir el registro.
   */
  cap: number | null;
  uses: number;
  /** Las reservas que todavía no vencen: ocupan lugar contra el tope. */
  liveReservations: number;
  duration: CodeDuration;
  monthlyCredits: number;
  dailyBrake: number;
  status: CodeStatus;
  /** Quién lo pausó, si está en pausa: el equipo, o el freno del día. */
  pausedBy: 'team' | 'brake' | null;
  createdAt: string;
};

/** Un canje: quién, cuándo y qué cuenta creó. El de una cuenta que se borró no lleva ni correo ni cuenta. */
export type CodeRedemption = { email: string | null; accountId: string | null; redeemedAt: string; deleted: boolean };

export type CodeDetail = RegistrationCode & { redemptions: CodeRedemption[] };

/** Lo que pide el formulario de crear. `code: null` = generarlo al azar. */
export type NewCode = {
  code: string | null;
  label: string;
  from: string | null;
  until: string;
  /** Todo código nuevo lleva tope, también uno generado (enmienda 7b; CA-31 de la spec «Registro abierto» de aios-tower). */
  cap: number;
  duration: CodeDuration;
  monthlyCredits: number;
  dailyBrake: number;
  reason: string | null;
  key: string;
};

export const CODE_ACTIONS = ['pause', 'resume', 'revoke'] as const;
export type CodeAction = (typeof CODE_ACTIONS)[number];

/** Qué acciones admite un código según su estado: un revocado no vuelve (CA-5). */
export function actionsFor(code: Pick<RegistrationCode, 'status'>): CodeAction[] {
  switch (code.status) {
    case 'revoked': return [];
    case 'paused': return ['resume', 'revoke'];
    default: return ['pause', 'revoke'];
  }
}
