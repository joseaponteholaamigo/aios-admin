// La traducción de la auditoría del backend (`/v1/admin/auditoria`) al idioma del panel.
import type { AuditPage } from '../../domain/audit';
import { asArray, asRecord, str, strOrNull, warnUnknownFields, type Log } from './api-reading';

const EVENT_FIELDS = ['fecha', 'actor', 'canal', 'operacion', 'objetivo', 'motivo', 'antes', 'despues'] as const;

export function toAuditPage(body: unknown, log: Log): AuditPage {
  const b = asRecord(body, 'la auditoría');
  return {
    events: asArray(b.eventos, 'eventos').map((raw) => {
      const e = asRecord(raw, 'un evento');
      warnUnknownFields(e, EVENT_FIELDS, 'un evento de la auditoría', log);
      return {
        at: str(e.fecha, 'evento.fecha'),
        actor: str(e.actor, 'evento.actor'),
        channel: String(e.canal ?? ''),
        operation: str(e.operacion, 'evento.operacion'),
        target: str(e.objetivo, 'evento.objetivo'),
        reason: strOrNull(e.motivo),
        before: e.antes ?? null,
        after: e.despues ?? null,
      };
    }),
    next: strOrNull(b.siguiente),
    onlySome: b.soloAlgunas !== false,
  };
}
