// Las escrituras de M2b en la API de administración: crear una cuenta e invitar a una persona (spec
// «Crear empresas e invitar personas»).
//
// Aparte de las lecturas (`admin-read-api.server.ts`) porque responden distinto: un 409 o un 422 no
// es «el enlace ya no sirve», es un rechazo que el formulario muestra junto a su campo. Por eso aquí
// se lee el cuerpo de los errores, y allá no.
import type { CreatedAccount, InvitedPerson, NewAccount, NewPerson, WriteRejection } from '../../domain/account-creation';
import type { AccountDeletion, DeletedAccount } from '../../domain/account-deletion';
import type { PersonActionDone, PersonActionRequest } from '../../domain/person-actions';
import type { CreditLoad, LoadedLot, SeatsChange, SeatsChanged } from '../../domain/credits';
import { toBackendLoad, toBackendSeatsChange, toLoadedLot, toSeatsChanged } from './credits-mapping';
import { toBackendDeletion, toDeletedAccount } from './deletion-mapping';
import { AdminApiUnavailableError } from './admin-api.server';
import { ApiContractError, type Log } from './api-reading';
import { personActionPath, toBackendAccount, toBackendPerson, toCreatedAccount, toInvitedPerson, toPersonActionDone, toWriteRejection } from './write-mapping';

/** Crear una cuenta mueve y borra cosas: le cabe más que a una lectura, por debajo de los 30 s de su Lambda. */
const TIMEOUT_MS = 25000;

/**
 * Lo que respondió el backend: el dato, un rechazo para el formulario, «no tienes permiso» o «tu
 * sesión ya no sirve». Un 5xx, un 429 sin código (el freno de API Gateway) o no responder **lanzan**
 * `AdminApiUnavailableError`. Un 429 con código es un rechazo: el tope diario de invitaciones.
 */
export type WriteResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'rejected'; rejection: WriteRejection; createdAccountId: string | null }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' };

export type AdminWriteApi = {
  createAccount(token: string, account: NewAccount): Promise<WriteResult<CreatedAccount>>;
  invitePerson(token: string, companyId: string, person: NewPerson): Promise<WriteResult<InvitedPerson>>;
  personAction(token: string, companyId: string, request: PersonActionRequest): Promise<WriteResult<PersonActionDone>>;
  deleteAccount(token: string, companyId: string, deletion: AccountDeletion): Promise<WriteResult<DeletedAccount>>;
  /** Los asientos de una empresa Personalizado. */
  changeSeats(token: string, companyId: string, change: SeatsChange): Promise<WriteResult<SeatsChanged>>;
  /** Cargar créditos a una persona de esa cuenta: un lote que vence a un mes. */
  loadCredits(token: string, companyId: string, load: CreditLoad): Promise<WriteResult<LoadedLot>>;
};

/** Los estados cuyo cuerpo trae un rechazo para el formulario. */
const REJECTION_STATUSES = new Set([401, 404, 409, 413, 422, 429, 503]);

async function readJson(response: Response, path: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    throw new ApiContractError(`La API de admin respondió algo que no es JSON (${path})`, { cause });
  }
}

export function createAdminWriteApi({
  baseUrl,
  fetchImpl = fetch,
  log = (message: string) => console.warn(message),
}: { baseUrl: string; fetchImpl?: typeof fetch; log?: Log }): AdminWriteApi {
  async function post<T>(path: string, token: string, body: unknown, map: (b: unknown) => T, method: 'POST' | 'PATCH' = 'POST'): Promise<WriteResult<T>> {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (cause) {
      throw new AdminApiUnavailableError(`No se pudo llamar a la API de admin (${path})`, { cause });
    }
    if (response.ok) return { kind: 'ok', value: map(await readJson(response, path)) };
    if (response.status === 403) return { kind: 'forbidden' };
    if (REJECTION_STATUSES.has(response.status)) {
      // `.catch`: un 401 del autorizador de API Gateway no trae JSON, y eso es «la sesión ya no sirve».
      const rejected = toWriteRejection(await response.json().catch(() => null));
      if (rejected) return { kind: 'rejected', ...rejected };
      if (response.status === 401) return { kind: 'unauthorized' };
    }
    throw new AdminApiUnavailableError(`La API de admin respondió ${response.status} (${path})`);
  }
  return {
    createAccount: (token, account) => post('/v1/admin/clientes', token, toBackendAccount(account), (b) => toCreatedAccount(b, log)),
    invitePerson: (token, companyId, person) =>
      post(`/v1/admin/clientes/${encodeURIComponent(companyId)}/personas`, token, toBackendPerson(person), toInvitedPerson),
    personAction: (token, companyId, { action, email }) =>
      post(personActionPath(companyId, action), token, { correo: email }, (b) => toPersonActionDone(action, b)),
    deleteAccount: (token, companyId, deletion) =>
      post(`/v1/admin/clientes/${encodeURIComponent(companyId)}/borrado`, token, toBackendDeletion(deletion), toDeletedAccount),
    changeSeats: (token, companyId, change) =>
      post(`/v1/admin/clientes/${encodeURIComponent(companyId)}/condiciones`, token, toBackendSeatsChange(change), toSeatsChanged, 'PATCH'),
    // El correo va en el cuerpo, como en las acciones sobre una persona: nunca en la URL.
    loadCredits: (token, companyId, load) => post(`/v1/admin/clientes/${encodeURIComponent(companyId)}/creditos`, token, toBackendLoad(load), toLoadedLot),
  };
}
