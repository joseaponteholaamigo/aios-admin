// El formulario de «Cambiar asientos» de una empresa Personalizado (spec «Créditos por persona» de
// aios-tower, CA-19 y CB-9): cuántos asientos y por qué. Dice cuántos están en uso, porque no se
// puede bajar por debajo de ellos.
import { Form, Link } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { REASON_MAX, SEATS_MAX } from '../seats-form-data';
import './seats-form.css';

type SeatsFormProps = {
  company: { id: string; name: string };
  current: number | null;
  used: number;
  values: Record<string, string> | null;
  errors: Record<string, string>;
  rejection: WriteRejection | null;
};

export function SeatsForm({ company, current, used, values, errors, rejection }: SeatsFormProps) {
  return (
    <Form method="post" className="seats-form">
      {rejection && <FormRejection rejection={rejection} />}
      <section className="card">
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="seats">Asientos</label>
            <input id="seats" name="seats" type="number" required min={Math.max(used, 1)} max={SEATS_MAX} step={1} defaultValue={values?.seats ?? current ?? ''} />
            <small>Hoy tiene {current ?? '—'} y ocupa {used}. Para bajar de {used}, primero saca a quien sobra.</small>
            <FieldError message={errors.seats} />
          </div>
          <div className="field">
            <label htmlFor="reason">Motivo</label>
            <input id="reason" name="reason" required maxLength={REASON_MAX} defaultValue={values?.reason ?? ''} placeholder="Ej: amplió el contrato, factura 1234" />
            <small>Queda en la auditoría, en Gobernanza, con quién hizo el cambio.</small>
            <FieldError message={errors.reason} />
          </div>
        </div>
        <div className="card-b seats-form__actions">
          <SubmitButton label="Guardar asientos" busyLabel="Guardando…" />
          <Link className="btn ghost" to={`/companies/${company.id}`}>Cancelar</Link>
        </div>
      </section>
    </Form>
  );
}
