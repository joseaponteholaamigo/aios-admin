// Lo que mandan los diálogos de «Revocar cuenta» y «Reactivar cuenta» (spec «Revocar y reactivar una cuenta», CA-12 a
// CA-14), lo que les responde su ruta y cuándo se ofrece confirmar. Puro: lo prueba `tests/account-status.test.ts`. El
// fondo (el id exacto, el cobro de Stripe, el estado al que vuelve) lo juzga el backend.
import type { WriteRejection } from '../../domain/account-creation';
import { isAccountStatusAction, type AccountStatusChange, type AccountStatusResult } from '../../domain/account-status';

/** La ruta de los dos diálogos: solo responde a un POST (`route-table.ts`). */
export const accountStatusHref = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/status`;

/**
 * Los campos. La acción no va en un campo `action`: un `<input name="action">` tapa la propiedad `form.action` del
 * formulario, que dice a dónde se manda.
 */
export const STATUS_FIELDS = { change: 'change', intent: 'intent', reason: 'reason', confirmation: 'confirmation' } as const;
export const PREVIEW_INTENT = 'preview';
export const SAVE_INTENT = 'save';

/** El motivo más largo que acepta el backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;

export type StatusFieldErrors = { reason?: string };

/** Lo que responde la ruta: la vista previa, o por qué no se hizo (un rechazo del backend o un campo que falta). */
export type StatusAnswer =
  | { ok: true; preview: AccountStatusResult }
  | { ok: false; rejection: WriteRejection | null; errors: StatusFieldErrors };

const UNREADABLE: StatusAnswer = { ok: false, rejection: { code: 'invalid', message: 'el pedido no se entiende' }, errors: {} };
const fieldError = (reason: string): { answer: StatusAnswer } => ({ answer: { ok: false, rejection: null, errors: { reason } } });

/**
 * El pedido (`{ change }`), o lo que vuelve al diálogo sin llegar a la API (`{ answer }`). La vista previa no lleva
 * motivo: se pide al abrir el diálogo. Al guardar, el motivo es opcional (decisión 2) y, al revocar, lleva lo escrito como id.
 */
export function readStatusChange(form: FormData): { change: AccountStatusChange } | { answer: StatusAnswer } {
  const action = form.get(STATUS_FIELDS.change);
  const intent = form.get(STATUS_FIELDS.intent);
  if (!isAccountStatusAction(action) || (intent !== PREVIEW_INTENT && intent !== SAVE_INTENT)) return { answer: UNREADABLE };
  if (intent === PREVIEW_INTENT) return { change: { action, reason: null, confirmation: null, previewOnly: true } };
  const reason = String(form.get(STATUS_FIELDS.reason) ?? '').trim();
  if (reason.length > REASON_MAX) return fieldError(`El motivo va hasta ${REASON_MAX} caracteres.`);
  const confirmation = action === 'revoke' ? String(form.get(STATUS_FIELDS.confirmation) ?? '') : null;
  return { change: { action, reason: reason || null, confirmation, previewOnly: false } };
}

/** Los rechazos de la vista previa que guardar también recibiría: con ellos no se ofrece confirmar. */
const FINAL_REJECTIONS: ReadonlySet<WriteRejection['code']> = new Set(['account-charging', 'not-found']);

/**
 * ¿Se ofrece confirmar? No mientras llega la vista previa (`undefined`): reactivar sin ver a qué estado vuelve sería a
 * ciegas (CA-13). Tampoco si dice que no hay nada que cambiar, o un rechazo que guardar repetiría. Otro rechazo (la API
 * no respondió) no lo frena: el backend vuelve a revisar todo al guardar.
 */
export function previewAllowsConfirm(answer: StatusAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer.ok) return answer.preview.changed;
  return !answer.rejection || !FINAL_REJECTIONS.has(answer.rejection.code);
}

/** ¿Es el pedido de una vista previa? Solo lee: la ficha no se vuelve a pedir por él. */
export const isStatusPreview = (form: FormData | undefined) =>
  form?.get(STATUS_FIELDS.intent) === PREVIEW_INTENT && isAccountStatusAction(form.get(STATUS_FIELDS.change));
