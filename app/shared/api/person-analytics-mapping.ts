// La traducción de la analítica de una persona entre el panel y el backend (`POST /v1/admin/clientes/{id}/analitica`,
// spec «Analítica de una persona», «Contrato de la API»): el pedido a sus nombres en español, y lo que responde de
// vuelta a los del panel. Los rechazos van con los demás, en `write-mapping.ts`.
import type {
  AnalyticsAction, AnalyticsRequest, AnalyticsSharing, PersonAnalytics, TermsAcceptance, TermsAcceptancePlace,
} from '../../domain/person-analytics';
import { ApiContractError, asArray, asRecord, str, strOrNull } from './api-reading';

/** La ruta del backend. Sin el correo: va en el cuerpo, porque los registros de acceso guardan la ruta (decisión 2). */
export const personAnalyticsPath = (companyId: string) => `/v1/admin/clientes/${encodeURIComponent(companyId)}/analitica`;

const ACTION_TO_API: Record<AnalyticsAction, string> = { view: 'ver', withdraw: 'retirar', restore: 'devolver' };
const SHARING_FROM_API = new Map<unknown, AnalyticsSharing>([['compartiendo', 'sharing'], ['retirada', 'withdrawn']]);
const PLACE_FROM_API = new Map<unknown, TermsAcceptancePlace>([['registro', 'signup'], ['ventana', 'app-window']]);

/** El cuerpo del pedido: la acción y el correo, y el motivo solo si se escribió uno. */
export function toBackendAnalyticsRequest({ action, email, reason }: AnalyticsRequest) {
  return { accion: ACTION_TO_API[action], correo: email, ...(reason ? { motivo: reason } : {}) };
}

function toTermsAcceptance(raw: unknown): TermsAcceptance {
  const t = asRecord(raw, 'una aceptación de los términos');
  return {
    version: str(t.version, 'una aceptación de los términos: version'),
    acceptedAt: strOrNull(t.aceptadoEl),
    recordedAt: strOrNull(t.registradoEl),
    // Un lugar que el panel no conoce no se inventa: queda sin dato.
    place: PLACE_FROM_API.get(t.donde) ?? null,
    declaredName: strOrNull(t.nombreDeclarado),
  };
}

/**
 * Lo que responde ver o cambiar. Un estado de la analítica que el panel no conoce rompe el contrato: mostrarlo como
 * «comparte» o «no comparte» le diría a soporte algo que no sabemos.
 */
export function toPersonAnalytics(body: unknown): PersonAnalytics {
  const b = asRecord(body, 'la analítica de la persona');
  const sharing = SHARING_FROM_API.get(b.analitica);
  if (!sharing) throw new ApiContractError(`la analítica de la persona trae un estado que el panel no conoce: ${String(b.analitica)}`);
  return {
    sharing,
    changedAt: strOrNull(b.cambiadaEl),
    termsAcceptances: asArray(b.terminos, 'la analítica de la persona: terminos').map(toTermsAcceptance),
    changed: typeof b.cambio === 'boolean' ? b.cambio : null,
  };
}
