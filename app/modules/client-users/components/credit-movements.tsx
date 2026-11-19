// Los últimos movimientos de créditos de una persona, en su diálogo de «Créditos» (CA-23): qué gastó,
// qué se le cargó o compró, y qué se le venció sin usar.
import type { CreditMovement } from '../../../domain/credits';
import { KIND_LABELS, conceptLabel, formatCredits, statusLabel } from '../../../shared/labels/credit-labels';
import { badgeClass } from '../../../shared/ui/badge';
import { formatDateTime } from '../../../shared/ui/format';

/** Cuánto movió: lo cobrado de un gasto (o lo reservado si sigue en curso), o los créditos de un lote. */
const amountOf = (m: CreditMovement) => (m.kind === 'spend' ? (m.status === 'in-progress' ? m.reserved : m.charged) : m.credits);

export function CreditMovements({ movements }: { movements: CreditMovement[] }) {
  if (movements.length === 0) return <p className="empty">Todavía no tiene movimientos.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Qué</th><th>Créditos</th></tr></thead>
        <tbody>
          {movements.map((m) => {
            const status = statusLabel(m.status);
            return (
              <tr key={m.id}>
                <td className="small">{formatDateTime(m.date)}</td>
                <td className="small">
                  {m.kind === 'spend' ? conceptLabel(m.concept) : `${KIND_LABELS[m.kind]}${m.name ? ` · ${m.name}` : ''}`}
                  {status && <> <span className={badgeClass(status.tone)}>{status.text}</span></>}
                </td>
                <td className="small mono">{formatCredits(amountOf(m))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
