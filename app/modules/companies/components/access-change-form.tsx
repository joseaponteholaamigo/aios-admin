// El paso 1 de «Reglas de acceso» (spec «Reglas de acceso», CA-12 y CA-13): una acción —dar o quitar— para
// uno o más dominios y skills del catálogo, y el motivo. «Ver el cambio» pide la vista previa sin guardar
// nada. Si se toca algo después de verla, quien lo contiene la esconde hasta volver a verlo.
import { Form, Link } from 'react-router';
import type { AccessCatalog } from '../../../domain/access-rules';
import { FieldError } from '../../../shared/ui/field-error';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { ACTION_FIELD, INTENT_FIELD, PREVIEW_INTENT, REASON_FIELD, REASON_MAX, type AccessFormValues } from '../access-change-form-data';
import { AccessTargetPicker } from './access-target-picker';
import './access-change-form.css';

type AccessChangeFormProps = {
  companyId: string;
  catalog: AccessCatalog;
  /** Lo elegido antes de ver el cambio o de un rechazo. */
  values: AccessFormValues | null;
  errors: Record<string, string>;
  /** Hay una vista previa a la vista: «Ver el cambio» deja de ser el botón principal. */
  previewShown: boolean;
  /** Lo elegido cambió: la vista previa que hubiera ya no es la de esto. */
  onEdit: () => void;
};

export function AccessChangeForm({ companyId, catalog, values, errors, previewShown, onEdit }: AccessChangeFormProps) {
  const action = values?.action === 'remove' ? 'remove' : 'grant';
  return (
    <Form method="post" className="access-change" onChange={onEdit}>
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 1</span><h2>Qué cambiar</h2>
          <p>Elige una acción y uno o más dominios o skills. Antes de guardar ves qué entra, qué sale y a cuántas personas les cambia.</p></div></div>
        <div className="card-b access-change__body">
          <fieldset className="access-change__action">
            <legend>Acción</legend>
            <label className="access-change__option">
              <input type="radio" name={ACTION_FIELD} value="grant" defaultChecked={action === 'grant'} />
              <span><strong>Dar</strong> <span className="small muted">· que lo reciba aunque su base no lo traiga</span></span>
            </label>
            <label className="access-change__option">
              <input type="radio" name={ACTION_FIELD} value="remove" defaultChecked={action === 'remove'} />
              <span><strong>Quitar</strong> <span className="small muted">· que no lo reciba aunque su base lo traiga</span></span>
            </label>
            <FieldError message={errors.action} />
          </fieldset>
          <AccessTargetPicker catalog={catalog} checked={new Set(values?.targets ?? [])} />
          <FieldError message={errors.targets} />
          <div className="field">
            <label htmlFor="access-reason">Motivo (opcional)</label>
            <input id="access-reason" name={REASON_FIELD} maxLength={REASON_MAX} defaultValue={values?.reason ?? ''} placeholder="Ej: contrató el módulo de ventas" />
            <small>Queda en la auditoría, en Gobernanza, con las reglas de antes y las de después. El cliente ve «cambio de acceso desde el panel de ENSŌ».</small>
            <FieldError message={errors.reason} />
          </div>
          <div className="access-change__buttons">
            <SubmitButton name={INTENT_FIELD} value={PREVIEW_INTENT} label="Ver el cambio" busyLabel="Calculando…" className={previewShown ? 'btn' : 'btn primary'} />
            <Link className="btn ghost" to={`/companies/${companyId}`}>Cancelar</Link>
          </div>
        </div>
      </section>
    </Form>
  );
}
