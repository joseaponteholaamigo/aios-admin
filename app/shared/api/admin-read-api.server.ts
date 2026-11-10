// Las lecturas de M2a de la API de administración (`/v1/admin/*`): empresas, personas, revisión
// de datos, auditoría y equipo.
//
// Aparte de `AdminApi` (`/yo`), a propósito: quien solo arma el menú no depende de todo esto.
// Llama con el access token de la sesión, que nunca sale del servidor del panel, y traduce cada
// respuesta aquí mismo: el resto del panel no ve un nombre del backend.
import type { DeletionPreview, PendingDeletion } from '../../domain/account-deletion';
import type { AuditPage } from '../../domain/audit';
import type { ClientUsersPage, CompanyPeople, DataCheckup, PeopleSearch } from '../../domain/client-users';
import type { AccountKind, CompaniesPage, CompaniesSearch, CompanyFile, CompanyHistoryEvent, ListPlan } from '../../domain/companies';
import type { TeamMember } from '../../domain/permissions';
import { AdminApiUnavailableError } from './admin-api.server';
import { ApiContractError, type Log } from './api-reading';
import { toAuditPage } from './audit-mapping';
import { toClientUsersPage, toCompanyPeople, toDataCheckup, toPeopleSearch } from './client-users-mapping';
import { toCompaniesPage, toCompaniesSearch, toCompanyFile, toCompanyHistory } from './companies-mapping';
import { toDeletionPreview, toPendingDeletions } from './deletion-mapping';
import { toTeamList } from './team-member-mapping';

const TIMEOUT_MS = 5000;

/**
 * La revisión de datos recorre todas las empresas (dos consultas por cada una) aunque el filtro deje
 * ver pocas: necesita más que el resto. Por debajo de los 10 s que tiene su Lambda.
 */
const CHECKUP_TIMEOUT_MS = 9000;

/**
 * Lo que respondió el backend, en lo que el panel hace con cada cosa: el dato, «no existe» (o la
 * API la esconde), «no tienes permiso», «tu sesión ya no sirve» o «el pedido no se entiende» (un
 * número de página que no sirve). Un 5xx, un 429 o no responder **lanzan** `AdminApiUnavailableError`.
 */
export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' }
  | { kind: 'invalid' };

export type AdminReadApi = {
  listCompanies(token: string, q: { kind: AccountKind; plan: ListPlan | null; page?: number }): Promise<ApiResult<CompaniesPage>>;
  searchCompanies(token: string, q: { text: string; kind: AccountKind; plan: ListPlan | null }): Promise<ApiResult<CompaniesSearch>>;
  getCompany(token: string, id: string): Promise<ApiResult<CompanyFile>>;
  getCompanyHistory(token: string, id: string): Promise<ApiResult<CompanyHistoryEvent[]>>;
  getCompanyPeople(token: string, id: string): Promise<ApiResult<CompanyPeople>>;
  /** `kind`: solo las personas de cuentas de ese tipo. No va con `company`: se filtra por una o por el otro. */
  listClientUsers(token: string, q: { company?: string; kind?: AccountKind | null; page?: number }): Promise<ApiResult<ClientUsersPage>>;
  searchPeople(token: string, q: { text: string; company: string; kind?: AccountKind | null }): Promise<ApiResult<PeopleSearch>>;
  getDataCheckup(token: string): Promise<ApiResult<DataCheckup>>;
  listAuditEvents(token: string, q: { target?: string | null; page?: number }): Promise<ApiResult<AuditPage>>;
  listTeam(token: string): Promise<ApiResult<TeamMember[]>>;
  /** Lo que se borraría de una cuenta, sin borrar nada. Solo el superadministrador. */
  getDeletionPreview(token: string, id: string): Promise<ApiResult<DeletionPreview>>;
  listPendingDeletions(token: string): Promise<ApiResult<PendingDeletion[]>>;
};

const STATUS_RESULT: Record<number, ApiResult<never>['kind']> = { 400: 'invalid', 401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 422: 'invalid' };

/** Los nombres del backend: el tipo de cuenta y el plan Personalizado. */
const KIND_TO_API: Record<AccountKind, string> = { company: 'empresa', personal: 'personal' };
const planToApi = (plan: ListPlan | null) => (plan === 'custom' ? 'personalizado' : plan);
const kindToApi = (kind: AccountKind | null | undefined) => (kind ? KIND_TO_API[kind] : null);

/** La página en el nombre del backend; la primera no viaja, como en la dirección del panel. */
const pageToApi = (page: number | undefined) => (page && page > 1 ? String(page) : null);

const query = (params: Record<string, string | null | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  return q.size ? `?${q}` : '';
};

export function createAdminReadApi({
  baseUrl,
  fetchImpl = fetch,
  log = (message: string) => console.warn(message),
}: { baseUrl: string; fetchImpl?: typeof fetch; log?: Log }): AdminReadApi {
  async function send<T>(path: string, token: string, map: (body: unknown) => T, { body, timeoutMs = TIMEOUT_MS }: { body?: unknown; timeoutMs?: number } = {}): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new AdminApiUnavailableError(`No se pudo llamar a la API de admin (${path.split('?')[0]})`, { cause });
    }
    const kind = STATUS_RESULT[response.status];
    if (kind) return { kind } as ApiResult<T>;
    if (!response.ok) throw new AdminApiUnavailableError(`La API de admin respondió ${response.status} (${path.split('?')[0]})`);
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      // Un 200 que no es JSON, o el plazo que vence a mitad del cuerpo: es el contrato roto, no un 500.
      throw new ApiContractError(`La API de admin respondió algo que no es JSON (${path.split('?')[0]})`, { cause });
    }
    return { kind: 'ok', value: map(json) };
  }
  const company = (id: string) => `/v1/admin/clientes/${encodeURIComponent(id)}`;
  return {
    listCompanies: (token, { kind, plan, page }) =>
      send(`/v1/admin/clientes${query({ tipo: kindToApi(kind), plan: planToApi(plan), pagina: pageToApi(page) })}`, token, (b) => toCompaniesPage(b, log)),
    // Por POST, con el texto en el cuerpo: una cuenta personal se busca por correo, y un correo no va en una URL.
    searchCompanies: (token, { text, kind, plan }) =>
      send('/v1/admin/clientes/buscar', token, (b) => toCompaniesSearch(b, log), { body: { texto: text, tipo: kindToApi(kind), plan: planToApi(plan) } }),
    getCompany: (token, id) => send(company(id), token, (b) => toCompanyFile(b, log)),
    getCompanyHistory: (token, id) => send(`${company(id)}/historia`, token, toCompanyHistory),
    getCompanyPeople: (token, id) => send(`${company(id)}/personas`, token, (b) => toCompanyPeople(b, log)),
    listClientUsers: (token, { company, kind, page }) =>
      send(`/v1/admin/personas${query({ empresa: company, tipo: kindToApi(kind), pagina: pageToApi(page) })}`, token, (b) => toClientUsersPage(b, log)),
    // Por POST, con el texto en el cuerpo: lo que se escribe de un correo no queda en ninguna URL ni en los logs de acceso.
    searchPeople: (token, { text, company, kind }) =>
      send('/v1/admin/personas/buscar', token, (b) => toPeopleSearch(b, log), { body: { texto: text, empresa: company, ...(kind ? { tipo: kindToApi(kind) } : {}) } }),
    getDataCheckup: (token) => send('/v1/admin/doctor', token, (b) => toDataCheckup(b, log), { timeoutMs: CHECKUP_TIMEOUT_MS }),
    listAuditEvents: (token, { target, page }) => send(`/v1/admin/auditoria${query({ objetivo: target, pagina: pageToApi(page) })}`, token, (b) => toAuditPage(b, log)),
    listTeam: (token) => send('/v1/admin/equipo', token, (b) => toTeamList(b, log)),
    getDeletionPreview: (token, id) => send(`${company(id)}/borrado`, token, (b) => toDeletionPreview(b, log)),
    listPendingDeletions: (token) => send('/v1/admin/borrados-pendientes', token, toPendingDeletions),
  };
}
