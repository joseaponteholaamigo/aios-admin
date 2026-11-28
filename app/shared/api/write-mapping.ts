// La traducción de las escrituras entre el panel y el backend (`POST /v1/admin/clientes`,
// `POST /v1/admin/clientes/{id}/personas` y sus acciones): el pedido a sus nombres en español, y la
// respuesta y cada rechazo de vuelta a los del panel. Los rechazos de todas las escrituras están aquí.
import type { CreatedAccount, InvitedPerson, NewAccount, NewPerson, PlanConditions, Quotas, WriteRejection } from '../../domain/account-creation';
import type { PersonAction, PersonActionDone, PersonActionRequest } from '../../domain/person-actions';
import { ApiContractError, asRecord, num, numOrNull, str, strOrNull, type Log } from './api-reading';
import { ACCOUNT_KIND_TO_API, toSeatStatus } from './client-users-mapping';
import { CODE_FIELD_FROM_API } from './codes-mapping';
import { TEAM_FIELD_FROM_API } from './team-mapping';
import { toDeletionSite } from './deletion-mapping';
import { toCompany } from './companies-mapping';

const CONTENT_TO_API = { all: 'todo', free: 'free', none: 'nada' } as const;
const QUOTA_TO_API = { radar: 'radar', projects: 'proyectos', skills: 'skills', chains: 'cadenas' } as const;

/** Los cupos en los nombres del backend. Un recurso que no está no viaja: hereda el del plan. */
export function quotasToApi(quotas: Quotas): Record<string, number | null> {
  return Object.fromEntries(Object.entries(quotas).map(([resource, value]) => [QUOTA_TO_API[resource as keyof Quotas], value ?? null]));
}

/** Las condiciones de un Personalizado sin los cupos: cada escritura decide si los manda. */
export const conditionsWithoutQuotasToApi = (c: PlanConditions) => ({
  contenido: CONTENT_TO_API[c.content], asientos: c.seats, equipo: c.team, horarios: c.schedules, hasta: c.endsOn,
});

/** Al crear, sin cupos no viajan: la cuenta nueva toma los de su plan. */
function conditionsToApi(c: PlanConditions) {
  const quotas = quotasToApi(c.quotas);
  return { ...conditionsWithoutQuotasToApi(c), ...(Object.keys(quotas).length ? { cupos: quotas } : {}) };
}

/** El cuerpo de `POST /v1/admin/clientes`. */
export function toBackendAccount(a: NewAccount) {
  return {
    // El Pro del panel (sin suscripción) es un Personalizado con las condiciones de Pro (`PRO_CONDITIONS`): el backend no tiene otro plan sin Stripe.
    nombre: a.name, tipo: ACCOUNT_KIND_TO_API[a.kind], plan: a.plan === 'free' ? 'free' : 'personalizado',
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

/** El mensaje del backend, solo si trae uno: qué quedó hecho o qué hacer. */
const withMessage = (b: Record<string, unknown>) => (strOrNull(b.error) ? { message: strOrNull(b.error) } : {});

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
  'no-existe': () => ({ code: 'not-found' }),
  'sin-login': (b) => ({ code: 'no-login', seat: b.asiento == null ? null : toSeatStatus(b.asiento) }),
  'ultimo-admin': () => ({ code: 'last-admin' }),
  'accion-incompleta': (b) => ({ code: 'action-incomplete', ...withMessage(b) }),
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
  'estado-no-permite': (b) => ({ code: 'state-not-allowed', ...withMessage(b) }),
  'codigo-ocupado': () => ({ code: 'code-busy' }),
  // El equipo ENSŌ (spec «Equipo ENSŌ»). Sin motivo y fuera del dominio van junto a su campo.
  'sin-motivo': (b) => ({ code: 'invalid', message: strOrNull(b.error) ?? 'falta el motivo', field: 'reason' }),
  'correo-fuera-del-dominio': (b) => invalid(b, 'al equipo solo entran correos @beenso.com'),
  'ya-en-el-equipo': (b) => ({ code: 'already-in-team', sub: strOrNull(b.sub) }),
  'a-si-mismo': () => ({ code: 'self-action' }),
  'invitacion-aceptada': () => ({ code: 'invitation-accepted' }),
  conflicto: () => ({ code: 'conflict' }),
  'pool-no-responde': () => ({ code: 'pool-unavailable' }),
  // Cambiar el rol, revocar y reenviar desde el panel (spec «Editar cuentas y personas»), con los nombres de «Mi equipo».
  'ya-revocado': () => ({ code: 'already-revoked' }),
  'ya-entro': () => ({ code: 'already-joined' }),
  'en-pausa': () => ({ code: 'seat-paused' }),
  'correo-no-disponible': () => ({ code: 'email-unavailable' }),
  'reenvio-limitado': (b) => ({ code: 'resend-limited', retryAt: strOrNull(b.reintentarEl) }),
  // Cambiar el plan (la misma spec).
  'cuenta-revocada': () => ({ code: 'account-revoked' }),
  'falta-confirmar': () => ({ code: 'needs-confirmation' }),
  // Las reglas de acceso de una empresa (spec «Reglas de acceso»): una clave fuera del catálogo o con dos acciones, y
  // lo que falta publicar para calcularlas (`error`: qué). `no-es-personalizado`, `falta-confirmar` y `conflicto`, arriba.
  'acceso-rechazado': (b) => ({ code: 'access-rejected', rejections: strings(b.rechazos) }),
  'sin-catalogo': (b) => ({ code: 'no-catalog', ...withMessage(b) }),
  // Pasar una empresa a cuenta personal, o al revés (spec «Pasar una empresa a cuenta personal, y al revés»). La vista
  // previa también los responde. `no-existe`, `invalido` y `conflicto`, arriba.
  'plan-de-equipo': () => ({ code: 'team-plan' }),
  'varias-personas': () => ({ code: 'several-people' }),
  moviendo: () => ({ code: 'moving' }),
  // Las claves de la casa (spec «Compartir referentes» de aios-tower): el proveedor rechazó la clave nueva (422, el
  // secreto no cambió), o el servicio no es uno que el backend administre (404).
  'clave-rechazada': () => ({ code: 'key-rejected' }),
  'servicio-desconocido': () => ({ code: 'unknown-service' }),
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
const PERSON_ACTION_TO_API: Record<PersonAction, string> = {
  'reset-mfa': 'restablecer-mfa', 'delete-login': 'borrar-login', 'delete-person': 'borrar',
  'change-role': 'cambiar-rol', 'resend-invitation': 'reenviar-invitacion', revoke: 'revocar',
};

/** El motivo, solo si se escribió uno: sin él, el backend pone el suyo. */
const reasonToApi = (reason: string) => (reason ? { motivo: reason } : {});

/**
 * El cuerpo de una acción sobre una persona: siempre el correo, nunca en la URL (CA-8). «Cambiar rol» manda solo lo
 * que cambió (`rol: null` es sin rol); revocar, su motivo.
 */
export function toBackendPersonAction(request: PersonActionRequest) {
  const correo = request.email;
  if (request.action === 'change-role') {
    const { role, isAdmin } = request.change;
    return { correo, ...(role !== undefined ? { rol: role } : {}), ...(isAdmin !== undefined ? { admin: isAdmin } : {}), ...reasonToApi(request.reason) };
  }
  if (request.action === 'revoke') return { correo, ...reasonToApi(request.reason) };
  return { correo };
}

/** La ruta de una acción sobre una persona. Sin el correo: va en el cuerpo (CA-8). */
export const personActionPath = (companyId: string, action: PersonAction) =>
  `/v1/admin/clientes/${encodeURIComponent(companyId)}/personas/${PERSON_ACTION_TO_API[action]}`;

const NOTICE_EMAIL: Record<string, 'sent' | 'not-sent'> = { enviado: 'sent', 'no-enviado': 'not-sent' };

const noticeEmailOf = (value: unknown) => (typeof value === 'string' ? NOTICE_EMAIL[value] ?? null : null);

/**
 * Lo que responde una acción sobre una persona. Destrabar y borrar traen el estado de la persona y el correo de aviso;
 * reenviar, si salió el correo de la invitación; cambiar el rol y revocar, la ficha de la persona, que aquí no hace falta.
 */
export function toPersonActionDone(action: PersonAction, body: unknown): PersonActionDone {
  const b = asRecord(body, 'la acción sobre la persona');
  if (action === 'resend-invitation') return { action, appUnlinked: null, noticeEmail: noticeEmailOf(b.correoDeInvitacion) };
  if (action === 'change-role' || action === 'revoke') return { action, appUnlinked: null, noticeEmail: null };
  const state = asRecord(b.estado, 'el estado de la persona');
  return { action, appUnlinked: typeof state.appDesvinculada === 'boolean' ? state.appDesvinculada : null, noticeEmail: noticeEmailOf(b.correoDeAviso) };
}
