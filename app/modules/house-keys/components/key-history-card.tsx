// El historial de la clave de la casa de un servicio y de su interruptor (spec «Compartir referentes» de
// aios-tower, D16): los últimos cambios hechos desde el panel, con quién, cuándo y el motivo. Sale de la
// auditoría del backend, que nunca guarda la clave ni sus últimos 4 caracteres.
import { HISTORY_SIZE, type HouseKeyHistoryEntry, type HouseKeyService } from '../../../domain/house-keys';
import { formatDateTime } from '../../../shared/ui/format';
import { historyActionLabel } from '../house-keys-labels';

export function KeyHistoryCard({ service, history }: { service: HouseKeyService; history: HouseKeyHistoryEntry[] }) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Historial</h2>
        <p>Cada cambio de la clave y del interruptor hecho desde el panel, con quién y por qué. Los últimos {HISTORY_SIZE}.</p></div></div>
      <div className="card-b">
        {history.length === 0
          ? <p className="empty">Todavía no hay cambios hechos desde el panel.</p>
          : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Motivo</th></tr></thead>
                <tbody>
                  {history.map((entry, i) => (
                    // Sin un id propio: la lista llega entera y en orden, y no se reordena en la página.
                    <tr key={`${entry.at ?? ''}-${i}`}>
                      <td className="small mono">{formatDateTime(entry.at)}</td>
                      <td className="small mono">{entry.by ?? '—'}</td>
                      <td>{historyActionLabel(entry.action, service)}</td>
                      <td className="small">{entry.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </section>
  );
}
