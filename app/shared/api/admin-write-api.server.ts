// Las escrituras de M2b en la API de administración: crear una cuenta e invitar a una persona (spec
// «Crear empresas e invitar personas»).
//
// Aparte de las lecturas (`admin-read-api.server.ts`) porque responden distinto: un 409 o un 422 no
// es «el enlace ya no sirve», es un rechazo que el formulario muestra junto a su campo. Por eso aquí
// se lee el cuerpo de los errores, y allá no.
import type { CreatedAccount, InvitedPerson, NewAccount, NewPerson, WriteRejection } from '../../domain/account-creation';
import type { AccessChange, AccessChangeResult } from '../../domain/access-rules';
import type { AccountDeletion, DeletedAccount } from '../../domain/account-deletion';
import type { AccountStatusChange, AccountStatusResult } from '../../domain/account-status';
import type { PersonActionDone, PersonActionRequest } from '../../domain/person-actions';
import type { CreditLoad, LoadedLot } from '../../domain/credits';
import type { PlanChange, PlanChangeResult } from '../../domain/plan-change';
import type { CodeAction, NewCode, RegistrationCode } from '../../domain/codes';
import type { VoiceCapChange, VoiceCapChanged } from '../../domain/voice-cap';
import type { HouseKeyChangeRequest, HouseKeyService } from '../../domain/house-keys';
import type { CreatedTeamMember, NewTeamMember, PermissionsChange, TeamAction, TeamPerson } from '../../domain/team';
import { codePath, toBackendCodeAction, toBackendNewCode, toWrittenCode } from './codes-mapping';
import {
  teamActionPath, teamPermissionsPath, toBackendNewTeamMember, toBackendPermissionsChange, toChangedTeamPerson, toCreatedTeamMember, toTeamPersonBody,
} from './team-mapping';
import { toBackendLoad, toLoadedLot } from './credits-mapping';
import { planChangePath, toBackendPlanChange, toPlanChangeResult } from './plan-change-mapping';
import { companyAccessPath, toAccessChangeResult, toBackendAccessChange } from './access-rules-mapping';
import { accountStatusPath, toAccountStatusResult, toBackendStatusChange } from './account-status-mapping';
import { toBackendDeletion, toDeletedAccount } from './deletion-mapping';
import { AdminApiUnavailableError } from './admin-api.server';
import { ApiContractError, type Log } from './api-reading';
import { houseKeyPath, toBackendHouseKeyChange } from './house-keys-mapping';
import { VOICE_CAP_PATH, toBackendVoiceCapChange, toVoiceCapChanged } from './voice-cap-mapping';
import {
  personActionPath, toBackendAccount, toBackendPerson, toBackendPersonAction, toCreatedAccount, toInvitedPerson, toPersonActionDone, toWriteRejection,
} from './write-mapping';

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
  /** El plan y las características de una cuenta: ver el cambio, o guardarlo (spec «Editar cuentas y personas», CA-28). */
  changePlan(token: string, companyId: string, change: PlanChange): Promise<WriteResult<PlanChangeResult>>;
  /** Dar o quitar dominios y skills a una empresa Personalizado, o volver a la base: ver el cambio, o guardarlo (spec «Reglas de acceso», CA-13). */
  changeAccess(token: string, companyId: string, change: AccessChange): Promise<WriteResult<AccessChangeResult>>;
  /** Revocar o reactivar una cuenta entera: ver qué pasaría, o hacerlo. Solo el superadministrador (spec «Revocar y reactivar una cuenta»). */
  changeAccountStatus(token: string, companyId: string, change: AccountStatusChange): Promise<WriteResult<AccountStatusResult>>;
  /** Cargar créditos a una persona de esa cuenta: un lote que vence a un mes. */
  loadCredits(token: string, companyId: string, load: CreditLoad): Promise<WriteResult<LoadedLot>>;
  /** Crear un código de registro: con la misma clave, crear dos veces es crear uno (CA-7). */
  createCode(token: string, code: NewCode): Promise<WriteResult<RegistrationCode>>;
  /** Pausar, reanudar o revocar un código (CA-5). */
  changeCodeState(token: string, code: string, action: CodeAction, reason: string | null): Promise<WriteResult<RegistrationCode>>;
  /** Cambiar el tope general de la voz, o poner o quitar la excepción de una cuenta. Solo el superadministrador (CA-33). */
  changeVoiceCap(token: string, change: VoiceCapChange): Promise<WriteResult<VoiceCapChanged>>;
  /**
   * Poner, cambiar o quitar la clave de la casa de un servicio, o encender o apagar su proveedor. Solo el
   * superadministrador, con motivo. Lo que queda lo vuelve a leer la página: la respuesta no se usa.
   */
  changeHouseKey(token: string, service: HouseKeyService, change: HouseKeyChangeRequest): Promise<WriteResult<null>>;
  /** Dar de alta a una persona del equipo ENSŌ: con la misma clave, dos veces es una (spec «Equipo ENSŌ», CA-2). */
  createTeamMember(token: string, member: NewTeamMember): Promise<WriteResult<CreatedTeamMember>>;
  /** Cambiar los permisos (y la marca de superadministrador) de una persona del equipo. */
  changeTeamPermissions(token: string, sub: string, change: PermissionsChange): Promise<WriteResult<TeamPerson>>;
  /** Suspender, reactivar, reenviar la invitación, restablecer el MFA o retirar a una persona del equipo. */
  /** `version`: la de la persona que se vio; si otro la cambió después, el backend responde `conflicto`. */
  teamAction(token: string, sub: string, action: TeamAction, reason: string, version: string | null): Promise<WriteResult<TeamPerson>>;
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
  async function post<T>(path: string, token: string, body: unknown, map: (b: unknown) => T, method: 'POST' | 'PATCH' | 'PUT' = 'POST'): Promise<WriteResult<T>> {
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
    personAction: (token, companyId, request) =>
      post(personActionPath(companyId, request.action), token, toBackendPersonAction(request), (b) => toPersonActionDone(request.action, b)),
    deleteAccount: (token, companyId, deletion) =>
      post(`/v1/admin/clientes/${encodeURIComponent(companyId)}/borrado`, token, toBackendDeletion(deletion), toDeletedAccount),
    changePlan: (token, companyId, change) => post(planChangePath(companyId), token, toBackendPlanChange(change), (b) => toPlanChangeResult(b, log), 'PATCH'),
    changeAccess: (token, companyId, change) => post(companyAccessPath(companyId), token, toBackendAccessChange(change), (b) => toAccessChangeResult(b, log)),
    changeAccountStatus: (token, companyId, change) => post(accountStatusPath(companyId), token, toBackendStatusChange(change), toAccountStatusResult),
    // El correo va en el cuerpo, como en las acciones sobre una persona: nunca en la URL.
    loadCredits: (token, companyId, load) => post(`/v1/admin/clientes/${encodeURIComponent(companyId)}/creditos`, token, toBackendLoad(load), toLoadedLot),
    createCode: (token, code) => post('/v1/admin/codigos', token, toBackendNewCode(code), toWrittenCode),
    changeCodeState: (token, code, action, reason) => post(`${codePath(code)}/estado`, token, toBackendCodeAction(action, reason), toWrittenCode),
    // La cuenta de una excepción va en el cuerpo, como en el resto de las escrituras con datos de un cliente.
    changeVoiceCap: (token, change) => post(VOICE_CAP_PATH, token, toBackendVoiceCapChange(change), toVoiceCapChanged, 'PUT'),
    // La clave va solo en el cuerpo, nunca en la ruta ni en un log. La respuesta se descarta: la página vuelve a leer.
    changeHouseKey: (token, service, change) => post(houseKeyPath(service), token, toBackendHouseKeyChange(change), () => null, 'PUT'),
    createTeamMember: (token, member) => post('/v1/admin/equipo', token, toBackendNewTeamMember(member), (b) => toCreatedTeamMember(b, log)),
    changeTeamPermissions: (token, sub, change) =>
      post(teamPermissionsPath(sub), token, toBackendPermissionsChange(change), (b) => toChangedTeamPerson(b, log), 'PUT'),
    teamAction: (token, sub, action, reason, version) =>
      post(teamActionPath(sub, action), token, { motivo: reason, ...(version ? { version } : {}) }, (b) => toTeamPersonBody(b, log)),
  };
}
