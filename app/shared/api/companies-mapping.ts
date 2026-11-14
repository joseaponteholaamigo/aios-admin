// La traducción de las empresas del backend (`/v1/admin/clientes…` y `/v1/admin/cuentas`) al idioma del panel.
import {
  ACCOUNT_ORIGINS, type AccessRule, type AccountCounts, type AccountOrigin, type AccountPerson, type CompaniesPage, type CompaniesSearch,
  type Company, type CompanyAccess, type CompanyFile, type CompanyHistoryEvent, type ContentBase, type CustomConditions, type EffectivePlan,
  type KindCount, type OriginCount, type PersonalAccountsPage, type Quotas,
} from '../../domain/companies';
import { isCursor } from '../../domain/pagination';
import { ApiContractError, asArray, asRecord, num, numOrNull, str, strOrNull, warnUnknownFields, type Log } from './api-reading';
import { toAccountKind, toSeatStatus } from './client-users-mapping';
import { toPageInfo } from './page-mapping';

const CONTENT_FROM_API: Record<string, ContentBase> = { todo: 'everything', free: 'free', nada: 'nothing' };
const ACTION_FROM_API: Record<string, AccessRule['action']> = { dar: 'grant', quitar: 'remove' };
const QUOTA_FROM_API: Record<string, string> = { radar: 'radar', proyectos: 'projects', skills: 'skills', cadenas: 'chains' };

const toContent = (value: unknown): ContentBase | null => CONTENT_FROM_API[String(value)] ?? null;
const boolOrNull = (value: unknown) => (typeof value === 'boolean' ? value : null);

/** Los cupos con sus nombres en inglés. `null` es «sin tope» (`SIN_TOPE` del backend); un cupo que el panel no conoce queda en el log. */
function toQuotas(raw: unknown, log: Log): Quotas {
  if (!raw || typeof raw !== 'object') return {};
  const quotas: Quotas = {};
  for (const [apiName, value] of Object.entries(raw)) {
    const name = QUOTA_FROM_API[apiName];
    if (!name) { log(`un plan trae un cupo que el panel no conoce y se ignora: ${apiName}`); continue; }
    quotas[name] = numOrNull(value);
  }
  return quotas;
}

const COMPANY_FIELDS = ['id', 'nombre', 'tipo', 'persona', 'nacidaDe', 'plan', 'estado', 'vencimiento', 'aviso', 'asientos', 'admins', 'pagaPorStripe', 'creadaEl'] as const;
const FILE_FIELDS = [...COMPANY_FIELDS, 'planEfectivo', 'condiciones', 'acceso', 'accesoPendiente'] as const;

const EXPIRED_BY: Record<string, Company['expiry']['expiredBy']> = { suscripcion: 'subscription', fecha: 'date' };

/** De dónde salió una cuenta personal (`nacidaDe`, CA-23 de «Registro abierto»), en los nombres del panel. */
const ORIGIN_FROM_API: Record<string, AccountOrigin> = { registro: 'signup', codigo: 'code', compra: 'purchase', webinar: 'webinar', equipo: 'team' };
const API_ORIGIN = Object.fromEntries(Object.entries(ORIGIN_FROM_API).map(([api, origin]) => [origin, api])) as Record<AccountOrigin, string>;

/**
 * El origen de una cuenta personal. El backend lo decide, también para una cuenta vieja sin el campo: aquí no
 * se adivina. Uno que el panel no conoce queda en `null` y en el log, nunca en otro origen.
 */
function toOrigin(raw: unknown, log: Log): AccountOrigin | null {
  if (raw === undefined || raw === null) return null;
  const origin = ORIGIN_FROM_API[String(raw)];
  if (!origin) log(`una cuenta personal trae un origen que el panel no conoce: ${String(raw)}`);
  return origin ?? null;
}

/** La persona de una cuenta personal, o `null` (una empresa, o una cuenta sin nadie). */
function toAccountPerson(raw: unknown): AccountPerson | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  return { email: str(p.correo, 'persona.correo'), status: toSeatStatus(p.estado), invitedAt: strOrNull(p.invitadoEl), acceptedAt: strOrNull(p.aceptadoEl) };
}

function toCompanyFields(r: Record<string, unknown>, log: Log): Company {
  const expiry = r.vencimiento && typeof r.vencimiento === 'object' ? (r.vencimiento as Record<string, unknown>) : {};
  const seats = r.asientos && typeof r.asientos === 'object' ? (r.asientos as Record<string, unknown>) : {};
  const kind = toAccountKind(r.tipo);
  return {
    id: str(r.id, 'empresa.id'),
    name: str(r.nombre, 'empresa.nombre'),
    kind,
    person: kind === 'personal' ? toAccountPerson(r.persona) : null,
    origin: kind === 'personal' ? toOrigin(r.nacidaDe, log) : null,
    plan: r.plan === 'personalizado' ? 'custom' : strOrNull(r.plan),
    status: strOrNull(r.estado),
    expiry: { expired: expiry.vencido === true, expiredBy: EXPIRED_BY[String(expiry.vencidoPor)] ?? null, until: strOrNull(expiry.hasta) },
    notice: strOrNull(r.aviso),
    seats: { used: num(seats.usados), cap: numOrNull(seats.tope) },
    admins: num(r.admins),
    paysWithStripe: r.pagaPorStripe === true,
    createdAt: strOrNull(r.creadaEl),
  };
}

export function toCompany(raw: unknown, log: Log): Company {
  const r = asRecord(raw, 'empresa');
  warnUnknownFields(r, COMPANY_FIELDS, 'una empresa', log);
  return toCompanyFields(r, log);
}

/** Cuántas de un tipo, por plan. Un conteo que no vino es cero: el backend viejo no lo mandaba. */
function toKindCount(raw: unknown): KindCount {
  const k = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const plans = k.planes && typeof k.planes === 'object' ? (k.planes as Record<string, unknown>) : {};
  return { total: num(k.total), plans: { free: num(plans.free), pro: num(plans.pro), team: num(plans.team), custom: num(plans.personalizado) } };
}

function toAccountCounts(raw: unknown): AccountCounts {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { companies: toKindCount(c.empresas), personal: toKindCount(c.personales) };
}

export function toCompaniesPage(body: unknown, log: Log): CompaniesPage {
  const b = asRecord(body, 'la lista de empresas');
  const companies = asArray(b.clientes, 'clientes').map((c) => toCompany(c, log));
  return {
    companies,
    page: toPageInfo(b.paginacion, companies.length),
    counts: toAccountCounts(b.conteo),
    onlySome: b.soloAlgunas !== false,
  };
}

/** Un número del índice. Uno que no es un entero rompe el contrato: nunca se muestra como 0. */
function counted(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value)) throw new ApiContractError(`${what}: no es un número entero`);
  return value as number;
}

/** Cuántas cuentas de un tipo cuenta el índice, en total y por origen. Un origen que el panel no conoce queda en el log. */
function toOriginCount(raw: unknown, what: string, log: Log): OriginCount {
  const c = asRecord(raw, what);
  const byOrigin = asRecord(c.porOrigen, `${what}.porOrigen`);
  warnUnknownFields(byOrigin, Object.keys(ORIGIN_FROM_API), `${what}.porOrigen`, log);
  return {
    total: counted(c.total, `${what}.total`),
    byOrigin: Object.fromEntries(ACCOUNT_ORIGINS.map((o) => [o, counted(byOrigin[API_ORIGIN[o]], `${what}.porOrigen.${API_ORIGIN[o]}`)])) as Record<AccountOrigin, number>,
  };
}

/** El cursor de la página siguiente: `null` en la última. Uno que no tiene la forma de un cursor rompe el contrato. */
function toNextCursor(value: unknown): string | null {
  if (value === null) return null;
  if (!isCursor(value)) throw new ApiContractError('siguiente: no es un cursor ni null');
  return value;
}

/** Una página de las cuentas personales por el índice (`GET /v1/admin/cuentas?tipo=personal`, CA-23 y CA-24 de «Registro abierto»). */
export function toPersonalAccountsPage(body: unknown, log: Log): PersonalAccountsPage {
  const b = asRecord(body, 'la lista de cuentas personales');
  const counts = asRecord(b.contadores, 'contadores');
  return {
    accounts: asArray(b.cuentas, 'cuentas').map((c) => toCompany(c, log)),
    next: toNextCursor(b.siguiente),
    counts: { companies: toOriginCount(counts.empresas, 'contadores.empresas', log), personal: toOriginCount(counts.personales, 'contadores.personales', log) },
    // Sin el dato, se avisa del filtro: callar que faltan cuentas es peor que avisar de más.
    onlySome: b.soloAlgunas !== false,
  };
}

export function toCompaniesSearch(body: unknown, log: Log): CompaniesSearch {
  const b = asRecord(body, 'la búsqueda de cuentas');
  return {
    companies: asArray(b.clientes, 'clientes').map((c) => toCompany(c, log)),
    hasMore: b.hayMas === true,
    onlySome: b.soloAlgunas !== false,
  };
}

/** El plan efectivo. Lo que falta sale en `null` (una fila vieja sin preset): la ficha muestra lo que se pudo leer (CB-5). */
function toEffectivePlan(raw: unknown, log: Log): EffectivePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const flags = p.flags && typeof p.flags === 'object' ? (p.flags as Record<string, unknown>) : {};
  return {
    tier: strOrNull(p.tier),
    preset: strOrNull(p.preset),
    flags: { collaboration: flags.collaboration === true, scheduling: flags.scheduling === true },
    quotas: toQuotas(p.cupos, log),
    seats: numOrNull(p.asientos),
    managesSeats: p.manejaAsientos === true,
  };
}

function toConditions(raw: unknown, log: Log): CustomConditions | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  return {
    seats: numOrNull(c.asientos),
    content: toContent(c.contenido),
    team: boolOrNull(c.equipo),
    scheduling: boolOrNull(c.horarios),
    until: strOrNull(c.hasta),
    quotas: toQuotas(c.cupos, log),
  };
}

function toAccess(raw: unknown): CompanyAccess | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const counts = a.cuenta && typeof a.cuenta === 'object' ? (a.cuenta as Record<string, unknown>) : {};
  const rules: AccessRule[] = asArray(a.reglas ?? [], 'acceso.reglas').map((rule) => {
    const r = asRecord(rule, 'una regla');
    return { key: str(r.clave, 'regla.clave'), action: ACTION_FROM_API[String(r.accion)] ?? 'unknown', missing: r.inexistente === true, inactive: r.inactiva === true };
  });
  return { base: toContent(a.base), rules, counts: { skills: num(counts.skills), agents: num(counts.agentes), chains: num(counts.cadenas) } };
}

export function toCompanyFile(body: unknown, log: Log): CompanyFile {
  const r = asRecord(body, 'la ficha');
  warnUnknownFields(r, FILE_FIELDS, 'la ficha de una empresa', log);
  return {
    ...toCompanyFields(r, log),
    effectivePlan: toEffectivePlan(r.planEfectivo, log),
    conditions: toConditions(r.condiciones, log),
    access: toAccess(r.acceso),
    accessPending: strOrNull(r.accesoPendiente),
  };
}

export function toCompanyHistory(body: unknown): CompanyHistoryEvent[] {
  return asArray(asRecord(body, 'la historia').historia, 'historia').map((raw) => {
    const e = asRecord(raw, 'un evento de la historia');
    return {
      source: e.origen === 'auditoria' ? 'audit' : 'account',
      at: str(e.fecha, 'evento.fecha'),
      actor: strOrNull(e.actor),
      what: str(e.que, 'evento.que'),
      reason: strOrNull(e.motivo),
      channel: strOrNull(e.canal),
      detail: e.detalle ?? null,
      before: e.antes ?? null,
      after: e.despues ?? null,
    };
  });
}
