// La traducción de las personas de los clientes y de la revisión de datos del backend
// (`/v1/admin/clientes/{id}/personas`, `/v1/admin/personas`, `/v1/admin/personas/buscar`, `/v1/admin/doctor`).
import type {
  ClientPerson, ClientRole, ClientUser, ClientUsersPage, CompanyPeople, DataCheckup, Finding, FindingKind, ItemCounts, PersonSearch, PersonSees, RoleBase,
  SeatCard, SeatStatus,
} from '../../domain/client-users';
import { asArray, asRecord, num, str, strOrNull, warnUnknownFields, type Log } from './api-reading';

const SEAT_STATUS_FROM_API: Record<string, SeatStatus> = { activo: 'active', invitado: 'invited', 'en-pausa': 'paused', revocado: 'revoked' };
const ROLE_BASE_FROM_API: Record<string, RoleBase> = { empresa: 'company', nada: 'nothing' };

const toSeatStatus = (value: unknown): SeatStatus => SEAT_STATUS_FROM_API[String(value)] ?? 'unknown';

const PEOPLE_FIELDS = ['cliente', 'empresa', 'roles', 'personas', 'revocadas', 'bitacora'] as const;

const toCounts = (raw: unknown): ItemCounts => {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { skills: num(c.skills), agents: num(c.agentes), chains: num(c.cadenas) };
};

function toSees(raw: unknown): PersonSees {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  switch (v.tipo) {
    case 'admin': return { kind: 'admin' };
    case 'rol': return { kind: 'role', role: String(v.rol ?? ''), adjustments: num(v.ajustes) };
    case 'todo': return { kind: 'everything', adjustments: num(v.ajustes) };
    case 'elegido': return { kind: 'chosen', chosen: num(v.elegidas) };
    case 'rol-inexistente': return { kind: 'missing-role', role: String(v.rol ?? '') };
    default: return { kind: 'unknown' };
  }
}

function toPerson(raw: unknown): ClientPerson {
  const p = asRecord(raw, 'una persona');
  return {
    email: str(p.correo, 'persona.correo'),
    role: strOrNull(p.rol),
    isAdmin: p.admin === true,
    status: toSeatStatus(p.estado),
    sees: toSees(p.ve),
    counts: toCounts(p.cuenta),
    invitedAt: strOrNull(p.invitadoEl),
    acceptedAt: strOrNull(p.aceptadoEl),
  };
}

function toRole(raw: unknown): ClientRole {
  const r = asRecord(raw, 'un rol');
  return {
    slug: str(r.slug, 'rol.slug'),
    label: strOrNull(r.label) ?? String(r.slug),
    base: ROLE_BASE_FROM_API[String(r.base)] ?? 'unknown',
    empty: r.vacio === true,
    people: num(r.personas),
    rules: Array.isArray(r.reglas) ? r.reglas.length : 0,
  };
}

export function toCompanyPeople(body: unknown, log: Log): CompanyPeople {
  const b = asRecord(body, 'las personas');
  warnUnknownFields(b, PEOPLE_FIELDS, 'las personas de una empresa', log);
  const client = asRecord(b.cliente, 'cliente');
  const company = asRecord(b.empresa, 'empresa');
  return {
    company: { id: str(client.id, 'cliente.id'), name: str(client.nombre, 'cliente.nombre') },
    domains: asArray(company.dominios ?? [], 'empresa.dominios').map((raw) => {
      const d = asRecord(raw, 'un dominio');
      return { slug: str(d.slug, 'dominio.slug'), skills: asArray(d.skills ?? [], 'dominio.skills').map(String) };
    }),
    counts: toCounts(company.cuenta),
    roles: asArray(b.roles, 'roles').map(toRole),
    people: asArray(b.personas, 'personas').map(toPerson),
    revoked: asArray(b.revocadas ?? [], 'revocadas').map((raw) => {
      const r = asRecord(raw, 'una revocada');
      return { email: str(r.correo, 'revocada.correo'), revokedAt: strOrNull(r.revocadoEl) };
    }),
    log: asArray(b.bitacora ?? [], 'bitacora').map((raw) => {
      const e = asRecord(raw, 'una entrada de la bitácora');
      return { action: String(e.accion ?? ''), actor: strOrNull(e.actor), about: strOrNull(e.sobre), at: String(e.cuando ?? '') };
    }),
  };
}

function toSeatCard(raw: unknown): SeatCard {
  const s = asRecord(raw, 'el asiento');
  return {
    email: str(s.correo, 'asiento.correo'),
    role: strOrNull(s.rol),
    isAdmin: s.admin === true,
    status: toSeatStatus(s.estado),
    invitedAt: strOrNull(s.invitadoEl),
    acceptedAt: strOrNull(s.aceptadoEl),
  };
}

const CLIENT_USER_FIELDS = ['correo', 'empresa', 'rol', 'admin', 'estado', 'invitadoEl', 'aceptadoEl'] as const;

function toClientUser(raw: unknown, log: Log): ClientUser {
  const p = asRecord(raw, 'una persona de la lista');
  warnUnknownFields(p, CLIENT_USER_FIELDS, 'una persona de la lista', log);
  const company = asRecord(p.empresa, 'empresa');
  return { ...toSeatCard(p), company: { id: str(company.id, 'empresa.id'), name: str(company.nombre, 'empresa.nombre') } };
}

export function toClientUsersPage(body: unknown, log: Log): ClientUsersPage {
  const b = asRecord(body, 'la lista de personas');
  return {
    people: asArray(b.personas, 'personas').map((p) => toClientUser(p, log)),
    next: strOrNull(b.siguiente),
    companies: asArray(b.empresas ?? [], 'empresas').map((raw) => {
      const c = asRecord(raw, 'una empresa del filtro');
      return { id: str(c.id, 'empresa.id'), name: str(c.nombre, 'empresa.nombre'), hasTeam: c.equipo === true };
    }),
    onlySome: b.soloAlgunas !== false,
  };
}

export function toPersonSearch(body: unknown): PersonSearch {
  const b = asRecord(body, 'la búsqueda');
  const onlySome = b.soloAlgunas !== false;
  if (b.encontrada !== true) return { found: false, onlySome };
  const company = asRecord(b.empresa, 'empresa');
  return { found: true, company: { id: str(company.id, 'empresa.id'), name: str(company.nombre, 'empresa.nombre') }, seat: toSeatCard(b.persona), onlySome };
}

/** Cada tipo de hallazgo del backend, con su nombre en el panel y lo que describe a uno. */
const FINDINGS_FROM_API: Record<string, { kind: FindingKind; detail: (h: Record<string, unknown>) => string | null }> = {
  credencialesHuerfanas: { kind: 'orphanCredentials', detail: (h) => (typeof h.hash === 'string' ? `credencial ${h.hash}…` : null) },
  clientesSinCredencial: { kind: 'companiesWithoutCredential', detail: (h) => strOrNull(h.nombre) },
  sinCredencialDePublicacion: { kind: 'withoutPublishCredential', detail: () => null },
  asientosSinIndice: { kind: 'seatsWithoutIndex', detail: (h) => strOrNull(h.estado) },
  asientosConCorreoEnOtraEmpresa: { kind: 'seatsInAnotherCompany', detail: (h) => `el correo entra a ${String(h.empresaDelCorreo ?? '?')}` },
  indicesObsoletos: { kind: 'staleIndexes', detail: (h) => strOrNull(h.motivo) },
  empresasSinAdmin: { kind: 'companiesWithoutAdmin', detail: (h) => (h.pagaPorStripe === true ? 'paga por Stripe' : strOrNull(h.nombre)) },
};

export function toDataCheckup(body: unknown, log: Log): DataCheckup {
  const b = asRecord(body, 'la revisión de datos');
  const raw = asRecord(b.hallazgos, 'hallazgos');
  warnUnknownFields(raw, Object.keys(FINDINGS_FROM_API), 'la revisión de datos', log);
  const findings = Object.fromEntries(Object.values(FINDINGS_FROM_API).map(({ kind }) => [kind, [] as Finding[]])) as Record<FindingKind, Finding[]>;
  for (const [apiKind, { kind, detail }] of Object.entries(FINDINGS_FROM_API)) {
    findings[kind] = asArray(raw[apiKind] ?? [], apiKind).map((item) => {
      const h = asRecord(item, 'un hallazgo');
      return { companyId: String(h.tenantId ?? ''), email: strOrNull(h.correo), detail: detail(h) };
    });
  }
  return { findings, total: num(b.total), outsideVisible: num(b.fueraDeLoVisible), onlySome: b.soloAlgunas !== false };
}
