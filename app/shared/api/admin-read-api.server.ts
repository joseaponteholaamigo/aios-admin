// Las lecturas de M2a de la API de administración (`/v1/admin/*`): empresas, personas, revisión
// de datos, auditoría y equipo.
//
// Aparte de `AdminApi` (`/yo`), a propósito: quien solo arma el menú no depende de todo esto.
// Llama con el access token de la sesión, que nunca sale del servidor del panel, y traduce cada
// respuesta aquí mismo: el resto del panel no ve un nombre del backend.
import type { AuditPage } from '../../domain/audit';
import type { CompanyPeople, DataCheckup, PersonSearch } from '../../domain/client-users';
import type { CompaniesPage, CompanyFile, CompanyHistoryEvent } from '../../domain/companies';
import type { TeamMember } from '../../domain/permissions';
import { AdminApiUnavailableError } from './admin-api.server';
import { ApiContractError, type Log } from './api-reading';
import { toAuditPage } from './audit-mapping';
import { toCompanyPeople, toDataCheckup, toPersonSearch } from './client-users-mapping';
import { toCompaniesPage, toCompanyFile, toCompanyHistory } from './companies-mapping';
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
 * cursor viejo). Un 5xx, un 429 o no responder **lanzan** `AdminApiUnavailableError`.
 */
export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' }
  | { kind: 'invalid' };

export type AdminReadApi = {
  listCompanies(token: string, q: { query?: string; cursor?: string | null }): Promise<ApiResult<CompaniesPage>>;
  getCompany(token: string, id: string): Promise<ApiResult<CompanyFile>>;
  getCompanyHistory(token: string, id: string): Promise<ApiResult<CompanyHistoryEvent[]>>;
  getCompanyPeople(token: string, id: string): Promise<ApiResult<CompanyPeople>>;
  findPerson(token: string, email: string): Promise<ApiResult<PersonSearch>>;
  getDataCheckup(token: string): Promise<ApiResult<DataCheckup>>;
  listAuditEvents(token: string, q: { target?: string | null; cursor?: string | null }): Promise<ApiResult<AuditPage>>;
  listTeam(token: string): Promise<ApiResult<TeamMember[]>>;
};

const STATUS_RESULT: Record<number, ApiResult<never>['kind']> = { 400: 'invalid', 401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 422: 'invalid' };

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
    listCompanies: (token, { query: q, cursor }) => send(`/v1/admin/clientes${query({ q, cursor })}`, token, (b) => toCompaniesPage(b, log)),
    getCompany: (token, id) => send(company(id), token, (b) => toCompanyFile(b, log)),
    getCompanyHistory: (token, id) => send(`${company(id)}/historia`, token, toCompanyHistory),
    getCompanyPeople: (token, id) => send(`${company(id)}/personas`, token, (b) => toCompanyPeople(b, log)),
    // Por POST, con el correo en el cuerpo: así no queda en ninguna URL ni en los logs de acceso.
    findPerson: (token, email) => send('/v1/admin/personas/buscar', token, toPersonSearch, { body: { correo: email } }),
    getDataCheckup: (token) => send('/v1/admin/doctor', token, (b) => toDataCheckup(b, log), { timeoutMs: CHECKUP_TIMEOUT_MS }),
    listAuditEvents: (token, { target, cursor }) => send(`/v1/admin/auditoria${query({ objetivo: target, cursor })}`, token, (b) => toAuditPage(b, log)),
    listTeam: (token) => send('/v1/admin/equipo', token, (b) => toTeamList(b, log)),
  };
}
