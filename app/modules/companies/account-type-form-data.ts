// Lo que manda el diálogo de «Pasar a cuenta personal» y «Pasar a empresa» (spec «Pasar una empresa a cuenta
// personal, y al revés», CA-12 a CA-14), lo que le responde su ruta y cuándo se ofrece guardar. Puro: lo prueba
// `tests/account-type.test.ts`. Si la cuenta puede pasar (su plan, sus personas, un mover en curso) lo juzga el backend.
import type { WriteRejection } from '../../domain/account-creation';
import { isAccountKind, type AccountTypeChange, type AccountTypeResult } from '../../domain/account-type';

/** La ruta del diálogo: solo responde a un POST (`route-table.ts`). */
export const accountTypeHref = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/type`;

export const TYPE_FIELDS = { kind: 'kind', intent: 'intent', reason: 'reason' } as const;
export const PREVIEW_INTENT = 'preview';
export const SAVE_INTENT = 'save';

/** El motivo más largo que acepta el backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;

export type TypeFieldErrors = { reason?: string };

/** Lo que responde la ruta: la vista previa, o por qué no se hizo (un rechazo del backend o un campo que falta). */
export type TypeAnswer =
  | { ok: true; preview: AccountTypeResult }
  | { ok: false; rejection: WriteRejection | null; errors: TypeFieldErrors };

const UNREADABLE: TypeAnswer = { ok: false, rejection: { code: 'invalid', message: 'el pedido no se entiende' }, errors: {} };
const fieldError = (reason: string): { answer: TypeAnswer } => ({ answer: { ok: false, rejection: null, errors: { reason } } });

/**
 * El pedido (`{ change }`), o lo que vuelve al diálogo sin llegar a la API (`{ answer }`). La vista previa no lleva
 * motivo: se pide al abrir el diálogo. Al guardar, el motivo es opcional (decisión 6).
 */
export function readTypeChange(form: FormData): { change: AccountTypeChange } | { answer: TypeAnswer } {
  const kind = form.get(TYPE_FIELDS.kind);
  const intent = form.get(TYPE_FIELDS.intent);
  if (!isAccountKind(kind) || (intent !== PREVIEW_INTENT && intent !== SAVE_INTENT)) return { answer: UNREADABLE };
  if (intent === PREVIEW_INTENT) return { change: { kind, reason: null, previewOnly: true } };
  const reason = String(form.get(TYPE_FIELDS.reason) ?? '').trim();
  if (reason.length > REASON_MAX) return fieldError(`El motivo va hasta ${REASON_MAX} caracteres.`);
  return { change: { kind, reason: reason || null, previewOnly: false } };
}

/**
 * Qué pasa con «Guardar» según la vista previa: `waiting`, se ve pero desactivado mientras llega; `ready`, la vista
 * previa dice que algo cambia (decisión 5); `none`, no se ofrece: la cuenta ya era de ese tipo, o un rechazo (CA-13).
 */
export type SaveOffer = 'waiting' | 'ready' | 'none';

/**
 * Solo se guarda después de una vista previa que dice que algo cambia. Las negativas (el plan, las personas, un mover)
 * solo las sabe el backend: guardar sin verlas sería a ciegas. Si la API no respondió, se vuelve a abrir el diálogo.
 */
export function saveOfferOf(answer: TypeAnswer | undefined): SaveOffer {
  if (!answer) return 'waiting';
  return answer.ok && answer.preview.changed ? 'ready' : 'none';
}

/** ¿Es el pedido de una vista previa? Solo lee: la ficha no se vuelve a pedir por él. */
export const isTypePreview = (form: FormData | undefined) =>
  form?.get(TYPE_FIELDS.intent) === PREVIEW_INTENT && isAccountKind(form.get(TYPE_FIELDS.kind));
