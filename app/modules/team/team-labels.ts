// Cómo se dice cada cosa del equipo ENSŌ en el panel (spec «Equipo ENSŌ»). Puras: las prueba
// `tests/team.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import type { Invitation, TeamAction, TeamPerson } from '../../domain/team';
import type { Label } from '../../shared/ui/badge';
import { rejectionMessage } from '../../shared/labels/write-rejection-labels';

/** La invitación, cuando vale la pena decirla: quien ya entró no lleva marca. */
export const INVITATION_LABELS: Record<Invitation, Label | null> = {
  pending: { text: 'Invitación pendiente', tone: 'accent' },
  expired: { text: 'Invitación vencida', tone: 'warn' },
  accepted: null,
};

const STATUS: Record<TeamPerson['status'], Label> = {
  active: { text: 'Activa', tone: 'ok' },
  inactive: { text: 'Suspendida', tone: 'warn' },
  retired: { text: 'Retirada', tone: '' },
};
export const statusLabel = (p: Pick<TeamPerson, 'status'>) => STATUS[p.status];

export const roleLabel = (p: Pick<TeamPerson, 'isSuperadmin'>): Label =>
  (p.isSuperadmin ? { text: 'Superadministrador', tone: 'accent' } : { text: 'Equipo', tone: '' });

/** Cómo se llama a la persona en un título: su nombre, su correo o su `sub`. */
export const displayName = (p: Pick<TeamPerson, 'name' | 'email' | 'sub'>) => p.name ?? p.email ?? p.sub;

type ActionText = {
  label: string;
  busy: string;
  title: (name: string) => string;
  /** Qué va a pasar, antes de confirmar. */
  explanation: string;
  confirm: string;
  /** El aviso de la página después de hacerlo. */
  done: string;
  /** Rojo: corta el acceso de alguien. */
  danger: boolean;
};

export const ACTION_TEXTS: Record<TeamAction, ActionText> = {
  suspend: {
    label: 'Suspender', busy: 'Suspendiendo…', title: (n) => `¿Suspender a ${n}?`, confirm: 'Suspender', danger: true,
    explanation: 'Deja de entrar al panel en este momento y se cierran sus sesiones. Sus permisos quedan guardados: si la reactivas, vuelve con los mismos.',
    done: 'Quedó suspendida: ya no entra al panel.',
  },
  reactivate: {
    label: 'Reactivar', busy: 'Reactivando…', title: (n) => `¿Reactivar a ${n}?`, confirm: 'Reactivar', danger: false,
    explanation: 'Vuelve a entrar al panel con los permisos que tenía.',
    done: 'Quedó activa: vuelve a entrar con los permisos que tenía.',
  },
  'resend-invitation': {
    label: 'Reenviar invitación', busy: 'Reenviando…', title: (n) => `¿Reenviar la invitación a ${n}?`, confirm: 'Reenviar', danger: false,
    explanation: 'Le llega por correo otra contraseña temporal. Vence en 1 día.',
    done: 'Le llegó otra contraseña temporal por correo. Vence en 1 día.',
  },
  'reset-mfa': {
    label: 'Restablecer MFA', busy: 'Restableciendo…', title: (n) => `¿Restablecer el MFA de ${n}?`, confirm: 'Restablecer', danger: false,
    explanation: 'Se desvincula su app de códigos y se cierran sus sesiones. Al entrar con su contraseña, vincula una app nueva.',
    done: 'Su app de códigos quedó desvinculada: al entrar, vincula una nueva.',
  },
  retire: {
    label: 'Retirar del equipo', busy: 'Retirando…', title: (n) => `¿Retirar a ${n} del equipo?`, confirm: 'Retirar del equipo', danger: true,
    explanation: 'Se borra su cuenta del login y pierde todos sus permisos. Su nombre queda en la historia. Para que vuelva, hay que darla de alta otra vez.',
    done: 'Quedó retirada del equipo.',
  },
};

/** El aviso que viaja en la dirección después de algo hecho (`?aviso=`): nunca lleva un correo. */
export const NOTICE_PARAM = 'aviso';
const NOTICES: Record<string, string> = {
  creada: 'Le llegó un correo con su contraseña temporal. Vence en 1 día; si no entra a tiempo, reenvía la invitación.',
  permisos: 'Permisos guardados.',
  ...Object.fromEntries(Object.entries(ACTION_TEXTS).map(([action, t]) => [action, t.done])),
};
export const noticeOf = (params: URLSearchParams) => NOTICES[params.get(NOTICE_PARAM) ?? ''] ?? null;

/** Un rechazo del backend dicho para el equipo: el estado que cambió es el de una persona, no el de un código. */
export function teamRejectionMessage(rejection: WriteRejection): string {
  if (rejection.code === 'state-not-allowed') return 'Esa persona cambió de estado mientras tanto: recarga la página para ver cómo quedó.';
  return rejectionMessage(rejection);
}

/** Cada operación de la historia de una persona, dicha para la pantalla. */
export const OPERATION_LABELS: Record<string, string> = {
  'equipo.alta': 'Alta en el equipo',
  'equipo.cambiar-permisos': 'Cambio de permisos',
  'equipo.suspender': 'Suspendida',
  'equipo.reactivar': 'Reactivada',
  'equipo.reenviar-invitacion': 'Invitación reenviada',
  'equipo.restablecer-mfa': 'MFA restablecido',
  'equipo.retirar': 'Retirada del equipo',
};
