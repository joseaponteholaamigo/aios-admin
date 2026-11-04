// El formulario de «Nueva empresa» y «Nueva cuenta personal» (spec «Crear empresas e invitar
// personas», CA-17 a CA-21). Lo escrito vuelve a aparecer si el backend lo rechaza, con el error
// junto a su campo; y la clave del formulario es la misma en cada reintento (CA-6).
import { useState } from 'react';
import { Form, Link } from 'react-router';
import type { CreationPlan, WriteRejection } from '../../../domain/account-creation';
import type { AccountKind } from '../../../domain/companies';
import { Icon } from '../../../shared/icons/icon';
import { rejectionMessage, rejectionPlace } from '../../../shared/labels/write-rejection-labels';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { MoveFromPersonalNotice, SUBMIT_FIELD, SUBMIT_VALUE } from '../../../shared/ui/move-from-personal-notice';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { defaultConditions, NAME_MAX, REASON_MAX, type FormValues } from '../new-account-form-data';
import { PlanConditionsFields } from './plan-conditions-fields';
import './new-account-form.css';

type Props = {
  kind: AccountKind;
  formKey: string;
  canMove: boolean;
  values: FormValues | null;
  errors: Record<string, string>;
  rejection: WriteRejection | null;
  /** La cuenta que ya quedó creada aunque el pedido terminó en un rechazo (un corte después de crearla). */
  createdAccountId: string | null;
};

export function NewAccountForm({ kind, formKey, canMove, values, errors, rejection, createdAccountId }: Props) {
  const [plan, setPlan] = useState<CreationPlan>((values?.plan as CreationPlan | undefined) ?? 'custom');
  const personal = kind === 'personal';
  const name = values?.name ?? '';
  const place = rejection ? rejectionPlace(rejection) : null;
  return (
    <Form method="post" className="new-account">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={formKey} />
      {rejection && place === 'form' && <FormRejection rejection={rejection} />}
      {createdAccountId && (
        <div className="banner info" role="status">
          <Icon name="info" />
          <p>La cuenta ya quedó creada: <Link to={`/companies/${createdAccountId}`} className="mono">{createdAccountId}</Link>. Si vuelves a intentar con este formulario, se termina esa misma, no se crea otra.</p>
        </div>
      )}
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 1</span><h2>{personal ? 'La persona' : 'La empresa'}</h2>
          <p>{personal ? 'Una cuenta personal es de una persona sola.' : 'El admin recibe la invitación por correo y entra a ENSŌ con ese correo.'}</p></div></div>
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="name">{personal ? 'Nombre de la cuenta' : 'Nombre de la empresa'}</label>
            <input id="name" name="name" required maxLength={NAME_MAX} defaultValue={name} placeholder={personal ? 'Ej: Pro María Gómez' : 'Ej: Inmobiliaria Andina'} />
            <FieldError message={errors.name} />
          </div>
          <div className="field">
            <label htmlFor="adminEmail">{personal ? 'Correo de la persona' : 'Correo del admin'}</label>
            <input id="adminEmail" name="adminEmail" type="email" required maxLength={254} defaultValue={values?.adminEmail ?? ''} placeholder="nombre@empresa.com" />
            <small>Le llega la invitación para entrar.</small>
            <FieldError message={errors.adminEmail ?? (rejection && place === 'email' ? rejectionMessage(rejection) : null)} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 2</span><h2>El plan</h2><p>Pro y Team no se crean aquí: se compran en la web.</p></div></div>
        <div className="card-b">
          <div className="field new-account__plan">
            <label htmlFor="plan">Plan</label>
            <select id="plan" name="plan" value={plan} onChange={(e) => setPlan(e.target.value as CreationPlan)}>
              <option value="custom">Personalizado</option>
              <option value="free">Free</option>
            </select>
          </div>
          <PlanConditionsFields kind={kind} values={values} defaults={defaultConditions(kind)} errors={errors} hidden={plan !== 'custom'} />
          {rejection?.code === 'plan-rejected' && (
            <div className="banner" role="alert"><Icon name="alert" /><div><p>{rejectionMessage(rejection)}</p><ul>{rejection.rejections.map((r) => <li key={r}>{r}</li>)}</ul></div></div>
          )}
        </div>
      </section>
      <section className="card">
        <div className="card-b">
          <div className="field">
            <label htmlFor="reason">Motivo</label>
            <input id="reason" name="reason" required maxLength={REASON_MAX} defaultValue={values?.reason ?? ''} placeholder="Ej: contrato firmado el 4 de noviembre" />
            <small>Queda en la auditoría, en Gobernanza.</small>
            <FieldError message={errors.reason ?? errors.key} />
          </div>
          <div className="new-account__actions">
            <SubmitButton label={personal ? 'Crear cuenta personal' : 'Crear empresa'} busyLabel="Creando…" name={SUBMIT_FIELD} value={SUBMIT_VALUE} />
            <Link className="btn ghost" to={personal ? '/companies?kind=personal' : '/companies'}>Cancelar</Link>
          </div>
          {/* Después del botón principal: con Enter, el navegador usa el primer botón del formulario. */}
          {rejection && 'account' in rejection && <MoveFromPersonalNotice account={rejection.account} destination={name || 'la cuenta nueva'} canMove={canMove} />}
        </div>
      </section>
    </Form>
  );
}
