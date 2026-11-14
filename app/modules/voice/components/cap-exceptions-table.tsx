// Las cuentas con su propio tope de la voz (spec «Registro abierto» de aios-tower, CA-33): cuál, cuánto,
// quién lo puso y cuándo. «Quitar» no quita nada solo: abre la confirmación, que pide el motivo.
import { Link } from 'react-router';
import type { VoiceCapException } from '../../../domain/voice-cap';
import { formatDateTime } from '../../../shared/ui/format';
import { dollarsLabel } from '../voice-labels';

type CapExceptionsTableProps = {
  exceptions: VoiceCapException[];
  /** Elegir «Quitar» en una fila: la excepción y el botón, para devolverle el foco al cerrar. */
  onRemove: (exception: VoiceCapException, trigger: HTMLElement) => void;
};

export function CapExceptionsTable({ exceptions, onRemove }: CapExceptionsTableProps) {
  if (exceptions.length === 0) return <p className="empty">Ninguna cuenta tiene excepción: todas usan el tope general.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Cuenta</th><th className="num">Tope</th><th>Lo puso</th><th /></tr></thead>
        <tbody>
          {exceptions.map((exception) => {
            const name = exception.accountName ?? exception.accountId;
            return (
              <tr key={exception.accountId}>
                <td><Link to={`/companies/${encodeURIComponent(exception.accountId)}`}>{name}</Link><br /><small className="muted mono">{exception.accountId}</small></td>
                <td className="num">{dollarsLabel(exception.usd)}</td>
                <td className="small"><span className="mono">{exception.changedBy ?? '—'}</span><br /><small className="muted">{formatDateTime(exception.changedAt)}</small></td>
                <td>
                  <button type="button" className="btn sm ghost" aria-label={`Quitar la excepción de ${name}`} onClick={(e) => onRemove(exception, e.currentTarget)}>Quitar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
