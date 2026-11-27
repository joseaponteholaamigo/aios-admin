// La vista previa de «Cambiar plan» (spec «Editar cuentas y personas», CA-28): el antes y el después, los
// avisos del backend y lo que hay que confirmar antes de «Guardar». Todavía no se guardó nada.
import type { AccountKind } from '../../../domain/companies';
import type { PlanChangeResult } from '../../../domain/plan-change';
import { Icon } from '../../../shared/icons/icon';
import { confirmationLabel, sentence, snapshotRows } from '../plan-change-labels';
import './plan-change-preview.css';

type PlanChangePreviewProps = {
  preview: PlanChangeResult;
  kind: AccountKind;
  /** Lo escrito cambió después de la vista previa anterior: esta es la nueva, y no se guardó. */
  stale: boolean;
};

export function PlanChangePreview({ preview, kind, stale }: PlanChangePreviewProps) {
  const rows = snapshotRows(preview, kind);
  return (
    <section className="card plan-change-preview" aria-live="polite">
      <div className="card-h"><div><span className="eyebrow accent">Paso 2</span><h2>El cambio</h2><p>Así queda la cuenta si guardas. Todavía no se guardó nada.</p></div></div>
      <div className="card-b plan-change-preview__body">
        {stale && <div className="banner info" role="status"><Icon name="info" /><p>Lo escrito cambió después de ver el cambio, así que no se guardó: esta es la vista previa nueva. Revísala antes de guardar.</p></div>}
        {!preview.changed ? <p className="empty">Lo pedido ya es lo que tiene: no hay nada que guardar.</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Qué</th><th>Antes</th><th>Después</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className={row.before === row.after ? undefined : 'plan-change-preview__changed'}>
                    <td className="small">{row.label}</td>
                    <td className="small">{row.before}</td>
                    <td className="small">{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {preview.notices.length > 0 && (
          <ul className="plan-change-preview__notices">
            {preview.notices.map((notice) => <li key={notice} className="small">{sentence(notice)}</li>)}
          </ul>
        )}
        {preview.changed && preview.toConfirm.length > 0 && (
          <div className="banner" role="alert">
            <Icon name="alert" />
            <div>
              <p>Al guardar, confirmas que:</p>
              <ul>{preview.toConfirm.map((c) => <li key={c}>{confirmationLabel(c, preview.pausedPeople)}</li>)}</ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
