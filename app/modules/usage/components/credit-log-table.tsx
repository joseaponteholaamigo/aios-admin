// Las filas de la bitácora de créditos (CA-27 a CA-29): una por operación, de la más reciente a la más
// vieja. Un gasto dice qué fue, cuánto, en qué estado va, lo reservado, lo cobrado y de dónde salió;
// una carga, quién la hizo y por qué; una compra, su paquete; un vencimiento, cuánto se perdió.
import { Link } from 'react-router';
import type { CreditLogRow } from '../../../domain/credits';
import { KIND_LABELS, amountLabel, conceptLabel, formatCredits, sourceLabel, statusLabel } from '../../../shared/labels/credit-labels';
import { badgeClass } from '../../../shared/ui/badge';
import { formatDateTime } from '../../../shared/ui/format';

function What({ row }: { row: CreditLogRow }) {
  if (row.kind === 'spend') return <>{conceptLabel(row.concept)} · <span className="muted">{amountLabel(row)}</span></>;
  const name = row.name ? ` · ${row.name}` : '';
  const who = row.kind === 'load' && (row.loadedBy || row.reason)
    ? <div className="muted">{[row.loadedBy && `por ${row.loadedBy}`, row.reason].filter(Boolean).join(' · ')}</div>
    : null;
  return <>{KIND_LABELS[row.kind]}{name}{who}</>;
}

function Amounts({ row }: { row: CreditLogRow }) {
  if (row.kind !== 'spend') {
    const lost = row.kind === 'expiry';
    return <><td className="small mono" colSpan={2}>{lost ? `${formatCredits(row.credits)} sin usar` : formatCredits(row.credits)}</td><td className="small">—</td></>;
  }
  return (
    <>
      <td className="small mono">{formatCredits(row.reserved)}</td>
      <td className="small mono">{formatCredits(row.charged)}{row.discarded ? <div className="muted">{formatCredits(row.discarded)} perdidos</div> : null}</td>
      <td className="small">{row.sources.map(sourceLabel).join(' + ') || '—'}</td>
    </>
  );
}

export function CreditLogTable({ rows }: { rows: CreditLogRow[] }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Empresa</th><th>Persona</th><th>Qué</th><th>Estado</th><th>Reservado</th><th>Cobrado</th><th>De dónde</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const status = statusLabel(row.status);
            return (
              <tr key={row.id}>
                <td className="small">{formatDateTime(row.date)}</td>
                <td className="small"><Link to={`/companies/${encodeURIComponent(row.company.id)}`}>{row.company.name ?? row.company.id}</Link></td>
                <td className="small">{row.email}</td>
                <td className="small"><What row={row} /></td>
                <td>{status ? <span className={badgeClass(status.tone)}>{status.text}</span> : '—'}</td>
                <Amounts row={row} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
