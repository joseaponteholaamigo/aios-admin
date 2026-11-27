// Lo que manda el diálogo «Analítica y términos» de una persona (spec «Analítica de una persona», CA-11 a CA-13) y lo
// que le responde su ruta. Vive en `shared/` porque lo abren dos pantallas: las personas de una cuenta y la ficha de una
// cuenta personal. Puro: lo prueba `tests/person-analytics.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import { isAnalyticsAction, type AnalyticsRequest, type PersonAnalytics } from '../../domain/person-analytics';

/** La ruta del diálogo: solo responde a un POST (`route-table.ts`). El correo va en el cuerpo, nunca aquí (decisión 2). */
export const personAnalyticsHref = (companyId: string) => `/client-users/${encodeURIComponent(companyId)}/analytics`;

/**
 * Los campos. La acción no va en un campo `action`: un `<input name="action">` tapa la propiedad `form.action` del
 * formulario. Ni en `intent`, que es el de las acciones sobre una persona de las mismas pantallas.
 */
export const ANALYTICS_FIELDS = { action: 'analytics', email: 'email', reason: 'reason' } as const;

/** El motivo más largo que acepta el backend (`LARGO_DEL_MOTIVO`). */
export const REASON_MAX = 500;

export type AnalyticsFieldErrors = { reason?: string };

/** Lo que responde la ruta: la analítica (vista o recién cambiada), o por qué no (un rechazo del backend o un campo de más). */
export type AnalyticsAnswer =
  | { ok: true; analytics: PersonAnalytics }
  | { ok: false; rejection: WriteRejection | null; errors: AnalyticsFieldErrors };

const UNREADABLE: AnalyticsAnswer = { ok: false, rejection: { code: 'invalid', message: 'el pedido no se entiende' }, errors: {} };

/**
 * El pedido (`{ request }`), o lo que vuelve al diálogo sin llegar a la API (`{ answer }`). Ver no lleva motivo. Al
 * cambiar, el motivo es opcional (decisión 3): vacío, no viaja.
 */
export function readAnalyticsRequest(form: FormData): { request: AnalyticsRequest } | { answer: AnalyticsAnswer } {
  const action = form.get(ANALYTICS_FIELDS.action);
  const email = String(form.get(ANALYTICS_FIELDS.email) ?? '').trim();
  if (!isAnalyticsAction(action) || !email.includes('@')) return { answer: UNREADABLE };
  if (action === 'view') return { request: { action, email, reason: null } };
  const reason = String(form.get(ANALYTICS_FIELDS.reason) ?? '').trim();
  if (reason.length > REASON_MAX) return { answer: { ok: false, rejection: null, errors: { reason: `El motivo va hasta ${REASON_MAX} caracteres.` } } };
  return { request: { action, email, reason: reason || null } };
}

/** ¿Es el pedido de ver? Solo lee: la pantalla de atrás no se vuelve a pedir por él. */
export const isAnalyticsView = (form: FormData | undefined) => form?.get(ANALYTICS_FIELDS.action) === 'view';
