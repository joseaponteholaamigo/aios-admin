// La traducción de las reglas de acceso de una empresa entre el panel y el backend
// (`GET` y `POST /v1/admin/clientes/{id}/acceso`, spec «Reglas de acceso», «Contrato de la API»): lo que
// se lee, el pedido a sus nombres en español, y la vista previa o lo guardado de vuelta a los del panel.
import type {
  AccessCatalog, AccessChange, AccessChangeResult, AccessConfirmation, AccessOperationAction, AccessTarget, AccessTargetKind, CatalogDomain,
  CatalogSkill, CompanyAccessReading, CompanyRule, PieceLists,
} from '../../domain/access-rules';
import { ApiContractError, asArray, asRecord, num, str, strOrNull, warnUnknownFields, type Log } from './api-reading';
import { toContent } from './companies-mapping';

export const companyAccessPath = (companyId: string) => `/v1/admin/clientes/${encodeURIComponent(companyId)}/acceso`;

const KIND_TO_API: Record<AccessTargetKind, string> = { domain: 'dominio', skill: 'skill' };
const KIND_FROM_API: Record<string, AccessTargetKind> = { dominio: 'domain', skill: 'skill' };
const OPERATION_TO_API: Record<AccessOperationAction, string> = { grant: 'dar', remove: 'quitar', reset: 'base' };
const ACTION_FROM_API: Record<string, CompanyRule['action']> = { dar: 'grant', quitar: 'remove' };

/** La clave de una regla en el backend: `dominio:convert`, `skill:copy`. */
const keyOf = ({ kind, name }: AccessTarget) => `${KIND_TO_API[kind]}:${name}`;

/** El objetivo de una clave del backend. Una que no es de un dominio ni de una skill rompe el contrato: el backend solo escribe esas. */
function toTarget(raw: unknown): AccessTarget {
  const key = str(raw, 'regla.clave');
  const at = key.indexOf(':');
  const kind = KIND_FROM_API[key.slice(0, at)];
  if (at < 1 || !kind || !key.slice(at + 1)) throw new ApiContractError(`una regla de acceso con una clave que no es de un dominio ni de una skill: ${key}`);
  return { kind, name: key.slice(at + 1) };
}

/** El nombre visible en español (`{ es, en }`, o un texto), o `null` si no trae uno: la pantalla cae al identificador. */
function visibleName(raw: unknown): string | null {
  if (typeof raw === 'string') return raw || null;
  if (!raw || typeof raw !== 'object') return null;
  return strOrNull((raw as Record<string, unknown>).es) || null;
}

function toRule(raw: unknown): CompanyRule {
  const r = asRecord(raw, 'una regla de acceso');
  return { target: toTarget(r.clave), action: ACTION_FROM_API[String(r.accion)] ?? 'unknown', missing: r.inexistente === true, inactive: r.inactiva === true };
}

function toCatalogDomain(raw: unknown): CatalogDomain {
  const d = asRecord(raw, 'un dominio del catálogo');
  return { slug: str(d.slug, 'dominio.slug'), name: visibleName(d.nombre), skills: num(d.skills), received: num(d.recibe) };
}

function toCatalogSkill(raw: unknown): CatalogSkill {
  const s = asRecord(raw, 'una skill del catálogo');
  return { name: str(s.nombre, 'skill.nombre'), label: visibleName(s.label), domain: strOrNull(s.dominio), received: s.recibe === true };
}

function toCatalog(raw: unknown): AccessCatalog {
  const c = asRecord(raw, 'el catálogo del acceso');
  return { domains: asArray(c.dominios, 'catalogo.dominios').map(toCatalogDomain), skills: asArray(c.skills, 'catalogo.skills').map(toCatalogSkill) };
}

const READ_FIELDS = ['tenantId', 'personalizado', 'base', 'reglas', 'recibe', 'catalogo'] as const;

/** Lo que responde `GET …/acceso`: la base, las reglas con su estado, cuánto recibe y el catálogo con nombres. */
export function toCompanyAccessReading(body: unknown, log: Log): CompanyAccessReading {
  const b = asRecord(body, 'el acceso de la empresa');
  warnUnknownFields(b, READ_FIELDS, 'el acceso de la empresa', log);
  const receives = b.recibe && typeof b.recibe === 'object' ? (b.recibe as Record<string, unknown>) : {};
  return {
    published: true,
    access: {
      custom: b.personalizado === true,
      base: toContent(b.base),
      rules: asArray(b.reglas ?? [], 'reglas').map(toRule),
      receives: { skills: num(receives.skills), agents: num(receives.agentes), chains: num(receives.cadenas) },
      catalog: toCatalog(b.catalogo),
    },
  };
}

/**
 * El 503 de `GET …/acceso` que dice que falta publicar algo (`sin-catalogo`), con qué falta. `null` si el 503 es otra
 * cosa: entonces es el backend que no respondió.
 */
export function toUnpublishedAccess(body: unknown): CompanyAccessReading | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return b.codigo === 'sin-catalogo' ? { published: false, missing: strOrNull(b.error) } : null;
}

/**
 * El cuerpo de `POST …/acceso`: una operación por objetivo, todas con la misma acción. Guardar va siempre con `confirmo`:
 * se oprime después de ver lo que hay que confirmar.
 */
export function toBackendAccessChange({ action, targets, reason, previewOnly }: AccessChange) {
  return {
    operaciones: targets.map((target) => ({ accion: OPERATION_TO_API[action], clave: keyOf(target) })),
    ...(reason ? { motivo: reason } : {}),
    ...(previewOnly ? { soloVer: true } : { confirmo: true }),
  };
}

const texts = (raw: unknown) => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);

function toPieces(raw: unknown): PieceLists {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { skills: texts(p.skills), agents: texts(p.agentes), chains: texts(p.cadenas) };
}

function toConfirmation(raw: unknown, log: Log): AccessConfirmation {
  if (raw === 'vacio') return 'empty';
  log(`el cambio de acceso pide confirmar algo que el panel no conoce: ${String(raw)}`);
  return 'unknown';
}

/** Lo que responde un cambio de acceso: la vista previa, o lo que quedó guardado. Sin correos: solo cuántas personas y reglas. */
export function toAccessChangeResult(body: unknown, log: Log): AccessChangeResult {
  const b = asRecord(body, 'el cambio de acceso');
  return {
    previewOnly: b.soloVer === true,
    changed: b.cambio === true,
    leaves: toPieces(b.sale),
    enters: toPieces(b.entra),
    affectedPeople: num(b.personasAfectadas),
    inactiveRules: num(b.reglasInactivas),
    toConfirm: (Array.isArray(b.confirmar) ? b.confirmar : []).map((c) => toConfirmation(c, log)),
  };
}
