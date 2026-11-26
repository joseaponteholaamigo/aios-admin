// El paso 2 de «Reglas de acceso» (spec «Reglas de acceso», CA-13): qué skills entran y salen, qué agentes
// y cadenas quedan o dejan de estar completos, a cuántas personas les cambia algo y cuántas reglas de su
// admin quedan inactivas, con lo que hay que confirmar y «Guardar». Todavía no se guardó nada.
import { Icon } from '../../../shared/icons/icon';
import type { ShownAccessPreview } from '../access-change-form-data';
import { affectedPeopleLabel, confirmationLabel, inactiveRulesLabel, pieceGroups, requestSummary, type NameLookup } from '../access-change-labels';
import { AccessChangeSave } from './access-change-save';
import './access-change-preview.css';

export function AccessChangePreview({ shown, names }: { shown: ShownAccessPreview; names: NameLookup }) {
  const { preview, request, stale } = shown;
  const groups = pieceGroups(preview, names);
  return (
    <section className="card access-preview" aria-live="polite">
      <div className="card-h"><div><span className="eyebrow accent">Paso 2</span><h2>El cambio</h2><p>Así queda la empresa si guardas. Todavía no se guardó nada.</p></div></div>
      <div className="card-b access-preview__body">
        {stale && <div className="banner info" role="status"><Icon name="info" /><p>Lo pedido cambió después de ver el cambio, así que no se guardó: esta es la vista previa nueva. Revísala antes de guardar.</p></div>}
        <p className="small"><strong>Lo pedido:</strong> {requestSummary(request, names)}</p>
        {!preview.changed ? <p className="empty">Lo pedido ya es lo que tiene: no hay nada que guardar.</p> : (
          <>
            {groups.length === 0 ? <p className="small muted">Cambian sus reglas, pero no lo que recibe: entra y sale lo mismo.</p> : (
              <div className="access-preview__groups">
                {groups.map((group) => (
                  <div key={group.title} className={`access-preview__group access-preview__group--${group.direction}`}>
                    <h3 className="small">{group.title} · {group.items.length}</h3>
                    <ul className="access-preview__items">{group.items.map((item) => <li key={item} className="small">{item}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
            <ul className="access-preview__counts">
              <li className="small">{affectedPeopleLabel(preview.affectedPeople)}</li>
              <li className="small">{inactiveRulesLabel(preview.inactiveRules)}</li>
            </ul>
            {preview.toConfirm.length > 0 && (
              <div className="banner" role="alert">
                <Icon name="alert" />
                <div>
                  <p>Al guardar, confirmas que:</p>
                  <ul>{preview.toConfirm.map((c) => <li key={c}>{confirmationLabel(c)}</li>)}</ul>
                </div>
              </div>
            )}
            <AccessChangeSave shown={shown} />
          </>
        )}
      </div>
    </section>
  );
}
