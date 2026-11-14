// La traducción de los códigos de registro entre el panel y el backend (`/v1/admin/codigos*`): sus
// nombres en español, a los del panel y de vuelta. El resto del panel no ve un nombre del backend.
import type { CodeAction, CodeDetail, CodeDuration, CodeRedemption, CodeStatus, NewCode, RegistrationCode } from '../../domain/codes';
import { ApiContractError, asRecord, num, numOrNull, str, strOrNull } from './api-reading';

const STATUS_FROM_API: Record<string, CodeStatus> = {
  activo: 'active', pausado: 'paused', revocado: 'revoked', vencido: 'expired', agotado: 'exhausted', 'todavia-no': 'not-yet',
};

function toDuration(raw: unknown): CodeDuration {
  const d = asRecord(raw, 'código.duracion');
  if (typeof d.meses === 'number') return { kind: 'months', n: d.meses };
  if (typeof d.dias === 'number') return { kind: 'days', n: d.dias };
  if (typeof d.hasta === 'string') return { kind: 'until', date: d.hasta };
  if (d.sinFin === true) return { kind: 'no-end' };
  throw new ApiContractError('código.duracion: no es meses, días, una fecha ni sin fin');
}

/**
 * El campo que señala un rechazo `invalido` del backend, en el nombre del formulario del panel. Solo
 * el alta de un código dice su campo; un nombre que no está aquí deja el rechazo arriba del formulario.
 */
export const CODE_FIELD_FROM_API: Record<string, string> = {
  codigo: 'code', etiqueta: 'label', desde: 'from', hasta: 'until', tope: 'cap', duracion: 'duration',
  creditosAlMes: 'monthlyCredits', frenoDiario: 'dailyBrake', motivo: 'reason', clave: 'key',
};

const toPausedBy = (raw: unknown): RegistrationCode['pausedBy'] => (raw === 'freno-diario' ? 'brake' : raw === 'equipo' ? 'team' : null);

/** Un código de la lista o del detalle. */
export function toCode(raw: unknown): RegistrationCode {
  const c = asRecord(raw, 'código');
  const status = STATUS_FROM_API[str(c.estado, 'código.estado')];
  if (!status) throw new ApiContractError(`código.estado desconocido: ${String(c.estado)}`);
  return {
    code: str(c.codigo, 'código.codigo'), label: str(c.etiqueta, 'código.etiqueta'), generated: c.generado === true,
    from: str(c.desde, 'código.desde'), until: str(c.hasta, 'código.hasta'),
    cap: numOrNull(c.tope), uses: num(c.usos), liveReservations: num(c.reservasVigentes),
    duration: toDuration(c.duracion), monthlyCredits: num(c.creditosAlMes), dailyBrake: num(c.frenoDiario),
    status, pausedBy: toPausedBy(c.motivoDePausa), createdAt: str(c.creadoEl, 'código.creadoEl'),
  };
}

export function toCodes(body: unknown): RegistrationCode[] {
  const b = asRecord(body, 'los códigos');
  if (!Array.isArray(b.codigos)) throw new ApiContractError('los códigos: falta la lista');
  return b.codigos.map(toCode);
}

function toRedemption(raw: unknown): CodeRedemption {
  const r = asRecord(raw, 'canje');
  return { email: strOrNull(r.correo), accountId: strOrNull(r.cuenta), redeemedAt: str(r.canjeadoEl, 'canje.canjeadoEl'), deleted: r.borrada === true };
}

export function toCodeDetail(body: unknown): CodeDetail {
  const b = asRecord(body, 'el código');
  const c = asRecord(b.codigo, 'el código');
  if (!Array.isArray(c.canjes)) throw new ApiContractError('el código: faltan los canjes');
  return { ...toCode(c), redemptions: c.canjes.map(toRedemption) };
}

/** El código de una respuesta de escritura (`{ codigo: { … } }`). */
export const toWrittenCode = (body: unknown): RegistrationCode => toCode(asRecord(body, 'el código').codigo);

function durationToApi(d: CodeDuration) {
  switch (d.kind) {
    case 'months': return { meses: d.n };
    case 'days': return { dias: d.n };
    case 'until': return { hasta: d.date };
    case 'no-end': return { sinFin: true };
  }
}

/**
 * El cuerpo de `POST /v1/admin/codigos`. Lo que no se eligió no viaja: el backend pone su valor por omisión.
 * El tope viaja siempre: sin él, el backend rechaza el código (CA-31 de «Registro abierto»).
 */
export function toBackendNewCode(n: NewCode) {
  return {
    ...(n.code ? { codigo: n.code } : {}),
    etiqueta: n.label, ...(n.from ? { desde: n.from } : {}), hasta: n.until,
    tope: n.cap,
    duracion: durationToApi(n.duration), creditosAlMes: n.monthlyCredits, frenoDiario: n.dailyBrake,
    ...(n.reason ? { motivo: n.reason } : {}), clave: n.key,
  };
}

const ACTION_TO_API: Record<CodeAction, string> = { pause: 'pausar', resume: 'reanudar', revoke: 'revocar' };

/** El cuerpo de `POST /v1/admin/codigos/{codigo}/estado`. */
export const toBackendCodeAction = (action: CodeAction, reason: string | null) => ({ accion: ACTION_TO_API[action], ...(reason ? { motivo: reason } : {}) });

/** La ruta de un código. Va en mayúsculas, como lo guarda el backend. */
export const codePath = (code: string) => `/v1/admin/codigos/${encodeURIComponent(code)}`;
