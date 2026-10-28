// La auditoría del equipo: quién hizo qué, sobre qué, cuándo y por qué. El antes y el después de
// cada cambio se abren sin JavaScript (`<details>`).
import type { AuditEvent } from '../../../domain/audit';
import { formatDateTime } from '../../../shared/ui/format';
import './audit-table.css';

const asText = (value: unknown) => (value === null || value === undefined ? '—' : JSON.stringify(value, null, 2));

export function AuditTable({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) return <p className="empty">Todavía no hay eventos.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Sobre</th><th>Por qué</th></tr></thead>
        <tbody>
          {events.map((event, i) => (
            <tr key={`${event.at}-${event.target}-${i}`}>
              <td className="small mono">{formatDateTime(event.at)}</td>
              <td className="small mono">{event.actor} <span className="chip">{event.channel}</span></td>
              <td className="small">
                <code>{event.operation}</code>
                {(event.before !== null || event.after !== null) && (
                  <details>
                    <summary className="tiny muted">Antes y después</summary>
                    <pre className="cmd">{`antes:\n${asText(event.before)}\n\ndespués:\n${asText(event.after)}`}</pre>
                  </details>
                )}
              </td>
              <td className="small mono">{event.target}</td>
              <td className="small">{event.reason ?? <span className="faint">sin motivo</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
