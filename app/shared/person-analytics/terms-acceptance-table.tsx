// La prueba de que la persona aceptó los Términos y la Política (spec «Analítica de una persona», CA-11): una fila por
// versión aceptada, de la más vieja a la más nueva, con la fecha del clic, la registrada, dónde y el nombre que
// escribió. Sin ninguna, lo dice.
import type { TermsAcceptance } from '../../domain/person-analytics';
import { formatDateTime } from '../ui/format';
import { NO_TERMS_ACCEPTANCE, TERMS_HEADING, TERMS_HINT, termsPlaceLabel } from './person-analytics-labels';
import './terms-acceptance-table.css';

export function TermsAcceptanceTable({ acceptances }: { acceptances: readonly TermsAcceptance[] }) {
  return (
    <section className="terms-acceptance-table">
      <h3 className="eyebrow accent">{TERMS_HEADING}</h3>
      {acceptances.length === 0 ? <p className="empty">{NO_TERMS_ACCEPTANCE}</p> : (
        <>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Versión</th><th>Fecha del clic</th><th>Fecha registrada</th><th>Dónde</th><th>Nombre que escribió</th></tr></thead>
              <tbody>
                {acceptances.map((a) => (
                  <tr key={a.version}>
                    <td className="small mono">{a.version}</td>
                    <td className="small">{formatDateTime(a.acceptedAt)}</td>
                    <td className="small">{formatDateTime(a.recordedAt)}</td>
                    <td className="small">{termsPlaceLabel(a.place)}</td>
                    <td className="small">{a.declaredName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="terms-acceptance-table__hint">{TERMS_HINT}</p>
        </>
      )}
    </section>
  );
}
