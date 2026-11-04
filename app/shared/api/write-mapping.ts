// La traducción de las escrituras de M2b entre el panel y el backend (`POST /v1/admin/clientes` y
// `POST /v1/admin/clientes/{id}/personas`): el pedido a sus nombres en español, y la respuesta y
// cada rechazo de vuelta a los del panel.
import type { CreatedAccount, InvitedPerson, NewAccount, NewPerson, PlanConditions, Quotas, WriteRejection } from '../../domain/account-creation';
import type { AccountKind } from '../../domain/companies';
import { ApiContractError, asRecord, num, numOrNull, str, strOrNull, type Log } from './api-reading';
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
    admin: a.adminEmail, motivo: a.reason, clave: a.key,
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
const REJECTIONS: Record<string, (b: Record<string, unknown>) => WriteRejection> = {
  invalido: (b) => ({ code: 'invalid', message: strOrNull(b.error) ?? 'el pedido no se entiende' }),
  'plan-rechazado': (b) => ({ code: 'plan-rejected', rejections: strings(b.rechazos) }),
  'correo-de-otra-empresa': (b) => ({ code: 'email-in-other-company', company: toCompanyRef(b.empresa) }),
  'correo-en-cuenta-personal': (b) => ({ code: 'email-in-personal-account', account: toAccountRef(b.cuenta) }),
  'cuenta-personal-con-cobro': (b) => ({ code: 'personal-account-pays', account: toAccountRef(b.cuenta) }),
  'rol-inexistente': (b) => ({ code: 'unknown-role', roles: strings(b.roles) }),
  'sin-cupo': (b) => ({ code: 'no-seats', used: num(b.usados), cap: numOrNull(b.tope) }),
  'ya-tiene-asiento': () => ({ code: 'already-has-seat' }),
  'asiento-revocado': () => ({ code: 'seat-revoked' }),
  'cupo-desconocido': () => ({ code: 'seats-unknown' }),
  'clave-usada': () => ({ code: 'key-used' }),
  'clave-vencida': () => ({ code: 'key-expired' }),
  'alta-en-curso': () => ({ code: 'in-progress' }),
  'filtro-de-clientes': () => ({ code: 'filter-on' }),
  'mover-incompleto': () => ({ code: 'move-incomplete' }),
  'mfa-reciente': () => ({ code: 'recent-mfa' }),
  'no-existe': () => ({ code: 'not-found' }),
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
