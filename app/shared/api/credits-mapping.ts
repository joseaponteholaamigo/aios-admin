// La traducción de los créditos entre el panel y el backend: el saldo de una persona
// (`POST /v1/admin/clientes/{id}/saldo`), la carga (`POST …/creditos`), la bitácora
// (`POST /v1/admin/creditos/bitacora`) y el cambio de asientos (`PATCH …/condiciones`).
import type {
  CreditAccess, CreditLoad, CreditLogFilters, CreditLogKind, CreditLogPage, CreditLogRow, CreditLot, CreditModule,
  CreditMovement, CreditSource, CreditStatus, LoadedLot, PersonCredits, SeatsChange, SeatsChanged,
} from '../../domain/credits';
import { asArray, asRecord, num, numOrNull, str, strOrNull, ApiContractError } from './api-reading';
import { toPageInfo } from './page-mapping';

const ACCESS: Record<string, CreditAccess> = { 'con-plan': 'with-plan', 'sin-plan': 'no-plan', 'sin-acceso': 'no-access' };
const KIND: Record<string, CreditLogKind> = { gasto: 'spend', carga: 'load', compra: 'purchase', vencimiento: 'expiry' };
const KIND_TO_API: Record<CreditLogKind, string> = { spend: 'gasto', load: 'carga', purchase: 'compra', expiry: 'vencimiento' };
const MODULE: Record<string, CreditModule> = { contactos: 'contacts', video: 'video', estudios: 'studios' };
const MODULE_TO_API: Record<CreditModule, string> = { contacts: 'contactos', video: 'video', studios: 'estudios' };
/** Los estados de un gasto: los del saldo de la persona (`reservada`…) y los de la bitácora (`en-curso`…). */
const STATUS: Record<string, CreditStatus> = {
  reservada: 'in-progress', liquidada: 'charged', devuelta: 'returned', vencida: 'expired',
  'en-curso': 'in-progress', cobrado: 'charged', devuelto: 'returned',
};

const recordOf = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

function toLot(raw: unknown): CreditLot {
  const l = asRecord(raw, 'el lote');
  return {
    id: str(l.id, 'lote.id'), origin: l.origen === 'compra' ? 'purchase' : 'load', name: strOrNull(l.nombre),
    credits: num(l.creditos), balance: num(l.saldo), creditedAt: str(l.acreditado, 'lote.acreditado'), expiresAt: str(l.vence, 'lote.vence'),
  };
}

function toMovement(raw: unknown): CreditMovement {
  const m = asRecord(raw, 'el movimiento');
  const kind = KIND[str(m.tipo, 'movimiento.tipo')];
  if (!kind) throw new ApiContractError(`movimiento.tipo: ${String(m.tipo)} no es un tipo conocido`);
  return {
    id: str(m.id, 'movimiento.id'), kind, date: str(m.fecha, 'movimiento.fecha'), concept: strOrNull(m.concepto),
    status: typeof m.estado === 'string' ? STATUS[m.estado] ?? null : null,
    reserved: numOrNull(m.reservado), charged: numOrNull(m.cobrado), credits: numOrNull(m.creditos), name: strOrNull(m.nombre),
  };
}

/** El saldo de una persona. */
export function toPersonCredits(body: unknown): PersonCredits {
  const b = asRecord(body, 'el saldo');
  const month = asRecord(b.mes, 'el saldo: mes');
  const access = ACCESS[str(b.acceso, 'saldo.acceso')];
  if (!access) throw new ApiContractError(`saldo.acceso: ${String(b.acceso)} no es un acceso conocido`);
  return {
    email: str(b.correo, 'saldo.correo'), access, available: num(b.saldo), reserved: num(b.reservado),
    month: { credits: num(month.creditos), balance: num(month.saldo), renewsAt: str(month.renueva, 'saldo.mes.renueva') },
    lots: asArray(b.lotes, 'saldo.lotes').map(toLot),
    movements: asArray(b.movimientos ?? [], 'saldo.movimientos').map(toMovement),
  };
}

/** El cuerpo de una carga. */
export const toBackendLoad = (load: CreditLoad) => ({ correo: load.email, creditos: load.credits, motivo: load.reason, clave: load.key });

/** Lo que responde una carga: el lote, con cuántos créditos y cuándo vence. */
export function toLoadedLot(body: unknown): LoadedLot {
  const lot = toLot(asRecord(body, 'la carga').lote);
  return { credits: lot.credits, expiresAt: lot.expiresAt };
}

/** El cuerpo del cambio de asientos. */
export const toBackendSeatsChange = (change: SeatsChange) => ({ asientos: change.seats, motivo: change.reason });

export function toSeatsChanged(body: unknown): SeatsChanged {
  const seats = asRecord(asRecord(body, 'el cambio de asientos').asientos, 'el cambio de asientos: asientos');
  return { before: numOrNull(seats.antes), after: num(seats.despues) };
}

/** El cuerpo de la bitácora: solo lo que se filtró, y la página si no es la primera. */
export function creditLogFiltersToApi(f: CreditLogFilters) {
  return {
    ...(f.company ? { empresa: f.company } : {}),
    ...(f.email ? { correo: f.email } : {}),
    ...(f.module ? { modulo: MODULE_TO_API[f.module] } : {}),
    ...(f.kind ? { tipo: KIND_TO_API[f.kind] } : {}),
    ...(f.from ? { desde: f.from } : {}),
    ...(f.to ? { hasta: f.to } : {}),
    ...(f.page > 1 ? { pagina: f.page } : {}),
  };
}

function toSource(raw: unknown): CreditSource {
  const s = asRecord(raw, 'la fuente de un gasto');
  if (s.fuente === 'mes') return { kind: 'month', month: str(s.mes, 'fuente.mes'), credits: num(s.creditos) };
  return { kind: 'lot', lotId: str(s.lote, 'fuente.lote'), name: strOrNull(s.nombre), credits: num(s.creditos) };
}

function toLogRow(raw: unknown): CreditLogRow {
  const r = asRecord(raw, 'la fila de la bitácora');
  const kind = KIND[str(r.tipo, 'fila.tipo')];
  if (!kind) throw new ApiContractError(`fila.tipo: ${String(r.tipo)} no es un tipo conocido`);
  const company = asRecord(r.empresa, 'fila.empresa');
  return {
    id: str(r.id, 'fila.id'), kind, date: str(r.fecha, 'fila.fecha'),
    company: { id: str(company.id, 'fila.empresa.id'), name: strOrNull(company.nombre) },
    email: str(r.correo, 'fila.correo'),
    module: typeof r.modulo === 'string' ? MODULE[r.modulo] ?? null : null,
    concept: strOrNull(r.concepto),
    status: typeof r.estado === 'string' ? STATUS[r.estado] ?? null : null,
    reserved: numOrNull(r.reservado), charged: numOrNull(r.cobrado), returned: numOrNull(r.devuelto), discarded: numOrNull(r.descartado),
    detail: recordOf(r.detalle), result: recordOf(r.resultado),
    sources: Array.isArray(r.de) ? r.de.map(toSource) : [],
    credits: numOrNull(r.creditos), name: strOrNull(r.nombre), expiresAt: strOrNull(r.vence),
    loadedBy: strOrNull(r.cargadoPor), reason: strOrNull(r.motivo),
  };
}

/** Una página de la bitácora. */
export function toCreditLogPage(body: unknown): CreditLogPage {
  const b = asRecord(body, 'la bitácora');
  const rows = asArray(b.filas, 'bitacora.filas').map(toLogRow);
  return { rows, page: toPageInfo(b.paginacion, rows.length) };
}
