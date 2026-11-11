// Cómo se dice cada cosa de un código de registro en el panel (spec «Códigos de registro», CA-4).
// Puras: las prueba `tests/codes.test.ts`.
import type { CodeAction, CodeDuration, CodeStatus, RegistrationCode } from '../../domain/codes';
import type { Label } from '../../shared/ui/badge';
import { formatDate } from '../../shared/ui/format';

const STATUS: Record<CodeStatus, Label> = {
  active: { text: 'Activo', tone: 'ok' },
  paused: { text: 'En pausa', tone: 'warn' },
  revoked: { text: 'Revocado', tone: 'bad' },
  expired: { text: 'Vencido', tone: '' },
  exhausted: { text: 'Agotado', tone: 'warn' },
  'not-yet': { text: 'Todavía no empieza', tone: 'accent' },
};

/** El estado, y por qué está en pausa si lo está: el freno del día se reanuda distinto que una pausa del equipo. */
export function statusLabel(code: Pick<RegistrationCode, 'status' | 'pausedBy'>): Label {
  if (code.status === 'paused' && code.pausedBy === 'brake') return { text: 'En pausa por el freno del día', tone: 'warn' };
  return STATUS[code.status];
}

/** «2 meses desde el canje», «hasta el 31 ene 2027», «sin fin». */
export function durationLabel(d: CodeDuration): string {
  switch (d.kind) {
    case 'months': return `${d.n} ${d.n === 1 ? 'mes' : 'meses'} desde el canje`;
    case 'days': return `${d.n} ${d.n === 1 ? 'día' : 'días'} desde el canje`;
    case 'until': return `hasta el ${formatDate(d.date)}`;
    case 'no-end': return 'sin fin';
  }
}

/** «37 de 300» o «37, sin tope». */
export const usesLabel = (c: Pick<RegistrationCode, 'uses' | 'cap'>) => (c.cap === null ? `${c.uses}, sin tope` : `${c.uses} de ${c.cap}`);

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** «1.000 al mes», o «sin créditos» si el código solo da el catálogo. */
export const creditsLabel = (n: number) => (n === 0 ? 'sin créditos' : `${thousands(n)} al mes`);

export const ACTION_LABELS: Record<CodeAction, { label: string; busy: string; done: string }> = {
  pause: { label: 'Pausar', busy: 'Pausando…', done: 'El código quedó en pausa: nadie puede reservarlo hasta que lo reanudes.' },
  resume: { label: 'Reanudar', busy: 'Reanudando…', done: 'El código volvió a estar activo, con el freno del día en cero.' },
  revoke: { label: 'Revocar', busy: 'Revocando…', done: 'El código quedó revocado: ya no se puede usar ni reanudar. Quienes lo canjearon conservan su plan.' },
};

/** El aviso que viaja en la dirección después de una acción (`?aviso=`): nunca lleva un correo. */
export const NOTICE_PARAM = 'aviso';
const NOTICES: Record<string, string> = {
  creado: 'El código quedó creado. Repártelo: cada persona que lo use se registra en ENSŌ y queda con su cuenta personal en Pro.',
  pause: ACTION_LABELS.pause.done,
  resume: ACTION_LABELS.resume.done,
  revoke: ACTION_LABELS.revoke.done,
};
export const noticeOf = (params: URLSearchParams) => NOTICES[params.get(NOTICE_PARAM) ?? ''] ?? null;
