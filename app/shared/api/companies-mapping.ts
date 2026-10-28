// La traducción de las empresas del backend (`/v1/admin/clientes…`) al idioma del panel.
import type {
  AccessRule, CompaniesPage, Company, CompanyAccess, CompanyFile, CompanyHistoryEvent, ContentBase, CustomConditions, EffectivePlan, Quotas,
} from '../../domain/companies';
import { asArray, asRecord, num, numOrNull, str, strOrNull, warnUnknownFields, type Log } from './api-reading';

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

const COMPANY_FIELDS = ['id', 'nombre', 'plan', 'estado', 'vencimiento', 'aviso', 'asientos', 'admins', 'pagaPorStripe', 'creadaEl'] as const;
const FILE_FIELDS = [...COMPANY_FIELDS, 'planEfectivo', 'condiciones', 'acceso', 'accesoPendiente'] as const;

const EXPIRED_BY: Record<string, Company['expiry']['expiredBy']> = { suscripcion: 'subscription', fecha: 'date' };

function toCompanyFields(r: Record<string, unknown>): Company {
  const expiry = r.vencimiento && typeof r.vencimiento === 'object' ? (r.vencimiento as Record<string, unknown>) : {};
  const seats = r.asientos && typeof r.asientos === 'object' ? (r.asientos as Record<string, unknown>) : {};
  return {
    id: str(r.id, 'empresa.id'),
    name: str(r.nombre, 'empresa.nombre'),
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
  return toCompanyFields(r);
}

export function toCompaniesPage(body: unknown, log: Log): CompaniesPage {
  const b = asRecord(body, 'la lista de empresas');
  return {
    companies: asArray(b.clientes, 'clientes').map((c) => toCompany(c, log)),
    next: strOrNull(b.siguiente),
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
    ...toCompanyFields(r),
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
