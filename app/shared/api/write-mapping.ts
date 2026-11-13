// La traducción de las escrituras de M2b entre el panel y el backend (`POST /v1/admin/clientes` y
// `POST /v1/admin/clientes/{id}/personas`): el pedido a sus nombres en español, y la respuesta y
// cada rechazo de vuelta a los del panel.
import type { CreatedAccount, InvitedPerson, NewAccount, NewPerson, PlanConditions, Quotas, WriteRejection } from '../../domain/account-creation';
import type { AccountKind } from '../../domain/companies';
import type { PersonAction, PersonActionDone } from '../../domain/person-actions';
import { ApiContractError, asRecord, num, numOrNull, str, strOrNull, type Log } from './api-reading';
import { toSeatStatus } from './client-users-mapping';
import { CODE_FIELD_FROM_API } from './codes-mapping';
import { TEAM_FIELD_FROM_API } from './team-mapping';
import { toDeletionSite } from './deletion-mapping';
import { toCompany } from './companies-mapping';

const KIND_TO_API: Record<AccountKind, string> = { company: 'empresa', personal: 'personal' };
const CONTENT_TO_API = { all: 'todo', free: 'free', none: 'nada' } as const;
const QUOTA_TO_API = { radar: 'radar', projects: 'proyectos', skills: 'skills', chains: 'cadenas' } as const;

function quotasToApi(quotas: Quotas): Record<string, number | null> {
  return Object.fromEntries(Object.entries(quotas).map(([resource, value]) => [QUOTA_TO_API[resource as keyof Quotas], value ?? null]));
}

function conditionsToApi(c: PlanConditions) {
  const quotas = quotasToApi(c.quotas);
  return {
    contenido: CONTENT_TO_API[c.content], asientos: c.seats, equipo: c.team, horarios: c.schedules, hasta: c.endsOn,
    ...(Object.keys(quotas).length ? { cupos: quotas } : {}),
  };
}

/** El cuerpo de `POST /v1/admin/clientes`. */
export function toBackendAccount(a: NewAccount) {
  return {
    nombre: a.name, tipo: KIND_TO_API[a.kind], plan: a.plan === 'custom' ? 'personalizado' : 'free',
    ...(a.conditions ? { condiciones: conditionsToApi(a.conditions) } : {}),
    admin: a.adminEmail, clave: a.key,
    ...(a.moveFromPersonal ? { moverDesdeCuentaPersonal: true } : {}),
  };
}

/** El cuerpo de `POST /v1/admin/clientes/{id}/personas`. */
export function toBackendPerson(p: NewPerson) {
  return {
    correo: p.email, admin: p.isAdmin, rol: p.role, motivo: p.reason,
    ...(p.moveFromPersonal ? { moverDesdeCuentaPersonal: true } : {}),
  };
}

const toAccountRef = (raw: unknown) => {
  const c = asRecord(raw, 'cuenta');
  return { id: str(c.id, 'cuenta.id'), name: str(c.nombre, 'cuenta.nombre'), paysWithStripe: c.pagaPorStripe === true };
};
const toCompanyRef = (raw: unknown) => (raw ? { id: str(asRecord(raw, 'empresa').id, 'empresa.id'), name: str(asRecord(raw, 'empresa').nombre, 'empresa.nombre') } : null);
const strings = (raw: unknown) => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);

/** Cada `codigo` del backend, en un rechazo del panel. Un código que no está aquí rompe el contrato. */
/** El campo que señala un rechazo `invalido`, en el nombre del formulario del panel: los de los códigos y los del equipo. */
const FIELD_FROM_API: Record<string, string> = { ...CODE_FIELD_FROM_API, ...TEAM_FIELD_FROM_API };
const invalid = (b: Record<string, unknown>, fallback = 'el pedido no se entiende'): WriteRejection => ({
  code: 'invalid', message: strOrNull(b.error) ?? fallback, field: FIELD_FROM_API[strOrNull(b.campo) ?? ''] ?? null,
});

const REJECTIONS: Record<string, (b: Record<string, unknown>) => WriteRejection> = {
  invalido: (b) => invalid(b),
  'plan-rechazado': (b) => ({ code: 'plan-rejected', rejections: strings(b.rechazos) }),
  'correo-de-otra-empresa': (b) => ({ code: 'email-in-other-company', company: toCompanyRef(b.empresa) }),
  'correo-en-cuenta-personal': (b) => ({ code: 'email-in-personal-account', account: toAccountRef(b.cuenta) }),
  'cuenta-personal-con-cobro': (b) => ({ code: 'personal-account-pays', account: toAccountRef(b.cuenta) }),
  'rol-inexistente': (b) => ({ code: 'unknown-role', roles: strings(b.roles) }),
  'sin-cupo': (b) => ({ code: 'no-seats', used: num(b.usados), cap: numOrNull(b.tope) }),
  'ya-tiene-asiento': () => ({ code: 'already-has-seat' }),
  'asiento-revocado': () => ({ code: 'seat-revoked' }),
  'cupo-desconocido': () => ({ code: 'seats-unknown' }),
  'tope-diario': (b) => ({ code: 'daily-invite-cap', retryAt: strOrNull(b.reintentarEl) }),
  'clave-usada': () => ({ code: 'key-used' }),
  'clave-vencida': () => ({ code: 'key-expired' }),
  'alta-en-curso': () => ({ code: 'in-progress' }),
  'filtro-de-clientes': () => ({ code: 'filter-on' }),
  'mover-incompleto': () => ({ code: 'move-incomplete' }),
  'mfa-reciente': () => ({ code: 'recent-mfa' }),
  'no-existe': () => ({ code: 'not-found' }),
  'sin-login': (b) => ({ code: 'no-login', seat: b.asiento == null ? null : toSeatStatus(b.asiento) }),
  'ultimo-admin': () => ({ code: 'last-admin' }),
  'accion-incompleta': () => ({ code: 'action-incomplete' }),
  'borrar-incompleto': () => ({ code: 'delete-incomplete' }),
  confirmacion: () => ({ code: 'confirmation' }),
  'cuenta-con-cobro': () => ({ code: 'account-charging' }),
  'borrado-en-curso': () => ({ code: 'deletion-in-progress' }),
  'borrado-incompleto': (b) => ({ code: 'deletion-incomplete', sites: strings(b.sitios).map(toDeletionSite) }),
  'asientos-en-uso': (b) => ({ code: 'seats-in-use', used: num(b.usados) }),
  'cuenta-personal': () => ({ code: 'personal-account' }),
  'no-es-personalizado': () => ({ code: 'not-custom' }),
  ocupado: () => ({ code: 'busy' }),
  'codigo-existe': () => ({ code: 'code-exists' }),
  'estado-no-permite': () => ({ code: 'state-not-allowed' }),
  'codigo-ocupado': () => ({ code: 'code-busy' }),
  // El equipo ENSŌ (spec «Equipo ENSŌ»). Sin motivo y fuera del dominio van junto a su campo.
  'sin-motivo': (b) => ({ code: 'invalid', message: strOrNull(b.error) ?? 'falta el motivo', field: 'reason' }),
  'correo-fuera-del-dominio': (b) => invalid(b, 'al equipo solo entran correos @beenso.com'),
  'ya-en-el-equipo': (b) => ({ code: 'already-in-team', sub: strOrNull(b.sub) }),
  'a-si-mismo': () => ({ code: 'self-action' }),
  'invitacion-aceptada': () => ({ code: 'invitation-accepted' }),
  conflicto: () => ({ code: 'conflict' }),
  'pool-no-responde': () => ({ code: 'pool-unavailable' }),
};

/**
 * El rechazo que dice el cuerpo de una respuesta de error, y la cuenta que ya quedó creada si la
 * hay (una creación que se cortó después de crearla). `null` si no trae un `codigo` que el panel conozca.
 */
export function toWriteRejection(body: unknown): { rejection: WriteRejection; createdAccountId: string | null } | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const translate = typeof b.codigo === 'string' ? REJECTIONS[b.codigo] : undefined;
  return translate ? { rejection: translate(b), createdAccountId: strOrNull(b.cuentaCreada) } : null;
}

/** Lo que responde una creación: la cuenta en la forma de la lista, si salió la invitación y de dónde se movió al admin. */
export function toCreatedAccount(body: unknown, log: Log): CreatedAccount {
  const b = asRecord(body, 'la cuenta creada');
  if (!b.cuenta) throw new ApiContractError('la cuenta creada: falta la cuenta');
  return { company: toCompany(b.cuenta, log), invitationSent: b.correoDeInvitacion === 'enviado', movedFrom: strOrNull(b.movidaDesde) };
}

/** Lo que responde una invitación. */
export function toInvitedPerson(body: unknown): InvitedPerson {
  const b = asRecord(body, 'la invitación');
  return { invitationSent: b.correoDeInvitacion === 'enviado', movedFrom: strOrNull(b.movidaDesde) };
}

/** Cada acción sobre una persona, como va en la ruta del backend (`…/personas/<acción>`). */
const PERSON_ACTION_TO_API: Record<PersonAction, string> = { 'reset-mfa': 'restablecer-mfa', 'delete-login': 'borrar-login', 'delete-person': 'borrar' };

/** La ruta de una acción sobre una persona. Sin el correo: va en el cuerpo (CA-8). */
export const personActionPath = (companyId: string, action: PersonAction) =>
  `/v1/admin/clientes/${encodeURIComponent(companyId)}/personas/${PERSON_ACTION_TO_API[action]}`;

const NOTICE_EMAIL: Record<string, 'sent' | 'not-sent'> = { enviado: 'sent', 'no-enviado': 'not-sent' };

/** Lo que responde una acción sobre una persona. */
export function toPersonActionDone(action: PersonAction, body: unknown): PersonActionDone {
  const b = asRecord(body, 'la acción sobre la persona');
  const state = asRecord(b.estado, 'el estado de la persona');
  return {
    action,
    appUnlinked: typeof state.appDesvinculada === 'boolean' ? state.appDesvinculada : null,
    noticeEmail: typeof b.correoDeAviso === 'string' ? NOTICE_EMAIL[b.correoDeAviso] ?? null : null,
  };
}
