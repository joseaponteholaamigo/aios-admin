// La lista de los códigos de registro (spec «Códigos de registro», CA-4): qué da cada uno, hasta
// cuándo sirve, cuántos usos lleva y en qué estado está. Un clic en la fila abre su detalle.
import { Link } from 'react-router';
import type { RegistrationCode } from '../../../domain/codes';
import { badgeClass } from '../../../shared/ui/badge';
import { formatDateTime } from '../../../shared/ui/format';
import { LinkedRow } from '../../../shared/ui/linked-row';
import { creditsLabel, durationLabel, statusLabel, usesLabel } from '../code-labels';

const detailOf = (code: RegistrationCode) => `/codes/${encodeURIComponent(code.code)}`;

export function CodesTable({ codes }: { codes: RegistrationCode[] }) {
  if (codes.length === 0) return <p className="empty">Todavía no hay códigos.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Código</th><th>Da</th><th>Vigencia</th><th className="num">Usos</th><th className="num">Reservas</th><th>Estado</th><th /></tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const status = statusLabel(code);
            return (
              <LinkedRow key={code.code} to={detailOf(code)}>
                <td><b className="mono">{code.code}</b><br /><small className="muted">{code.label}</small></td>
                <td className="small">Pro {durationLabel(code.duration)}<br /><small className="muted">{creditsLabel(code.monthlyCredits)}</small></td>
                <td className="small">{formatDateTime(code.from)}<br />→ {formatDateTime(code.until)}</td>
                <td className="num">{usesLabel(code)}</td>
                <td className="num">{code.liveReservations}</td>
                <td><span className={badgeClass(status.tone)}>{status.text}</span></td>
                <td><Link className="btn sm soft" to={detailOf(code)} aria-label={`Abrir ${code.code}`}>Abrir</Link></td>
              </LinkedRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
