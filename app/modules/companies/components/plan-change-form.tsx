// El formulario de «Cambiar plan» (spec «Editar cuentas y personas», CA-28): el plan, sus condiciones con
// lo que la cuenta tiene hoy puesto y el motivo; «Ver el cambio» pide la vista previa y «Guardar» manda el
// mismo pedido con la confirmación. Si se edita algo después de verlo, «Guardar» se va hasta volver a ver
// el cambio. Un rechazo deja la vista previa a la vista, con «Guardar» disponible otra vez (CA-29).
import { useEffect, useState } from 'react';
import { Form, Link } from 'react-router';
import type { CreationPlan, PlanConditions, WriteRejection } from '../../../domain/account-creation';
import type { AccountKind } from '../../../domain/companies';
import type { PlanChangeResult } from '../../../domain/plan-change';
import { Icon } from '../../../shared/icons/icon';
import { rejectionMessage, rejectionPlace } from '../../../shared/labels/write-rejection-labels';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { INTENT_FIELD, PREVIEW_INTENT, PREVIEWED_FIELD, REASON_MAX, SAVE_INTENT, planChoicesFor } from '../plan-change-form-data';
import { PRO_ENDS_ON_FIELD, type FormValues } from '../plan-conditions-form-data';
import { PlanChangePreview } from './plan-change-preview';
import { PlanConditionsFields } from './plan-conditions-fields';
import './plan-change-form.css';

const PLAN_NAMES: Record<CreationPlan, string> = { free: 'Free', pro: 'Pro', custom: 'Personalizado' };

/** Una vista previa con la huella del pedido que la pidió. */
export type ShownPreview = { preview: PlanChangeResult; previewed: string; stale: boolean };

type PlanChangeFormProps = {
  company: { id: string; kind: AccountKind };
  /** Lo que tiene hoy: su plan entre los que se ofrecen (o `null`, uno de la web) y sus condiciones. */
  current: { choice: CreationPlan | null; conditions: PlanConditions };
  /** Un Personalizado con cobro de Stripe: cambia sus condiciones, pero no pasa a Free (decisión 4). */
  lockedToCustom: boolean;
  seatsUsed: number;
  values: FormValues | null;
  errors: Record<string, string>;
  rejection: WriteRejection | null;
  /** La vista previa que trajo la última respuesta, si trajo una. */
  latest: ShownPreview | null;
};

export function PlanChangeForm({ company, current, lockedToCustom, seatsUsed, values, errors, rejection, latest }: PlanChangeFormProps) {
  const [plan, setPlan] = useState<string>(values?.plan ?? current.choice ?? '');
  const [shown, setShown] = useState<ShownPreview | null>(latest);
  const [edited, setEdited] = useState(false);
  // Una vista previa nueva reemplaza a la anterior; un rechazo o un error de campo no la borra.
  useEffect(() => {
    if (!latest) return;
    setShown(latest);
    setEdited(false);
  }, [latest]);
  const personal = company.kind === 'personal';
  const place = rejection ? rejectionPlace(rejection) : null;
  const preview = shown && !edited ? shown : null;
  const canSave = Boolean(preview?.preview.changed);
  return (
    <Form method="post" className="plan-change" onChange={() => setEdited(true)}>
      <input type="hidden" name="kind" value={company.kind} />
      {canSave && preview && <input type="hidden" name={PREVIEWED_FIELD} value={preview.previewed} />}
      {rejection && place === 'form' && <FormRejection rejection={rejection} />}
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 1</span><h2>El plan</h2>
          <p>{personal ? 'El Pro de aquí no tiene suscripción ni cobra. Pro y Team con suscripción se compran en la web.' : 'Pro y Team no se dan aquí: se compran en la web.'}</p></div></div>
        <div className="card-b plan-change__body">
          <div className="field plan-change__plan">
            <label htmlFor="plan">Plan</label>
            <select id="plan" name="plan" required value={plan} onChange={(e) => setPlan(e.target.value)}>
              {plan === '' && <option value="" disabled>Elige el plan</option>}
              {planChoicesFor(company.kind).map((choice) => (
                <option key={choice} value={choice} disabled={lockedToCustom && choice === 'free'}>{PLAN_NAMES[choice]}</option>
              ))}
            </select>
            {lockedToCustom && <small>Tiene una suscripción de Stripe que cobra: cambia sus condiciones, pero para pasar a Free primero hay que cancelarla en Stripe.</small>}
            <FieldError message={errors.plan} />
          </div>
          {plan === 'pro' && (
            <>
              <p className="muted small">Todo el contenido, la voz, los créditos del mes y los horarios, sin suscripción. Solo se elige la fecha de fin: para otras condiciones, elige Personalizado.</p>
              <div className="field plan-change__plan">
                <label htmlFor="pro-ends-on">Fecha de fin (opcional)</label>
                <input id="pro-ends-on" name={PRO_ENDS_ON_FIELD} type="date" defaultValue={values?.[PRO_ENDS_ON_FIELD] ?? (current.choice === 'pro' ? current.conditions.endsOn ?? '' : '')} />
                <small>Vacía: sin fecha de fin. Al llegar, la cuenta pasa a Free.</small>
                <FieldError message={errors[PRO_ENDS_ON_FIELD]} />
              </div>
            </>
          )}
          <PlanConditionsFields
            kind={company.kind} values={values} defaults={current.conditions} errors={errors} hidden={plan !== 'custom'}
            seatsHint={`Hoy ocupan ${seatsUsed}: para bajar de ahí, primero saca a quien sobra.`}
          />
          {rejection?.code === 'plan-rejected' && (
            <div className="banner" role="alert"><Icon name="alert" /><div><p>{rejectionMessage(rejection)}</p><ul>{rejection.rejections.map((r) => <li key={r}>{r}</li>)}</ul></div></div>
          )}
          <div className="field">
            <label htmlFor="reason">Motivo (opcional)</label>
            <input id="reason" name="reason" maxLength={REASON_MAX} defaultValue={values?.reason ?? ''} placeholder="Ej: amplió el contrato, factura 1234" />
            <small>Queda en la auditoría, en Gobernanza, con el plan de antes y el de después.</small>
            <FieldError message={errors.reason} />
          </div>
        </div>
      </section>
      {preview && <PlanChangePreview preview={preview.preview} kind={company.kind} stale={preview.stale} />}
      <section className="card">
        <div className="card-b plan-change__actions">
          {/* «Ver el cambio» va primero: con Enter, el navegador usa el primer botón, y ver nunca guarda. */}
          <SubmitButton name={INTENT_FIELD} value={PREVIEW_INTENT} label="Ver el cambio" busyLabel="Calculando…" className={canSave ? 'btn' : 'btn primary'} />
          {canSave && preview && (
            <SubmitButton name={INTENT_FIELD} value={SAVE_INTENT} label={preview.preview.toConfirm.length ? 'Confirmar y guardar' : 'Guardar'} busyLabel="Guardando…" />
          )}
          <Link className="btn ghost" to={`/companies/${company.id}`}>Cancelar</Link>
        </div>
      </section>
    </Form>
  );
}
