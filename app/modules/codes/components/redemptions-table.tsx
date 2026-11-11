// Quién canjeó un código, cuándo y qué cuenta creó (spec «Códigos de registro», CA-4). El canje de una
// cuenta que se borró dice «cuenta borrada», sin correo ni enlace (decisión 14).
import { Link } from 'react-router';
import type { CodeRedemption } from '../../../domain/codes';
import { formatDateTime } from '../../../shared/ui/format';

export function RedemptionsTable({ redemptions }: { redemptions: CodeRedemption[] }) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Canjes</h2><p>El más reciente primero.</p></div></div>
      <div className="card-b">
        {redemptions.length === 0 ? <p className="empty">Nadie lo ha canjeado todavía.</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Persona</th><th>Cuenta</th><th>Canjeado</th></tr></thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={`${r.accountId ?? 'borrada'}-${r.redeemedAt}`}>
                    <td className="small">{r.deleted ? <span className="badge">Cuenta borrada</span> : r.email}</td>
                    <td className="small">{r.accountId ? <Link className="mono" to={`/companies/${encodeURIComponent(r.accountId)}`}>{r.accountId}</Link> : '—'}</td>
                    <td className="small">{formatDateTime(r.redeemedAt)}</td>
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
