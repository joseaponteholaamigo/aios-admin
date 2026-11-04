// El formulario de «Invitar persona» a una cuenta (spec «Crear empresas e invitar personas», CA-22):
// correo, admin o no, rol y motivo. Los errores y la confirmación de mover son los de crear una
// cuenta (CA-19, CA-20).
import { Form, Link } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { ClientRole } from '../../../domain/client-users';
import { rejectionMessage, rejectionPlace } from '../../../shared/labels/write-rejection-labels';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { MoveFromPersonalNotice, SUBMIT_FIELD, SUBMIT_VALUE } from '../../../shared/ui/move-from-personal-notice';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { REASON_MAX, type FormValues } from '../invite-person-form-data';
import './invite-person-form.css';

type Props = {
  company: { id: string; name: string };
  roles: ClientRole[];
  canMove: boolean;
  values: FormValues | null;
  errors: Record<string, string>;
  rejection: WriteRejection | null;
};

export function InvitePersonForm({ company, roles, canMove, values, errors, rejection }: Props) {
  const place = rejection ? rejectionPlace(rejection) : null;
  const fieldRejection = (where: string) => (rejection && place === where ? rejectionMessage(rejection) : null);
  return (
    <Form method="post" className="invite-person">
      {rejection && place === 'form' && <FormRejection rejection={rejection} />}
      <section className="card">
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" required maxLength={254} defaultValue={values?.email ?? ''} placeholder="nombre@empresa.com" />
            <small>Le llega la invitación para entrar a {company.name}.</small>
            <FieldError message={errors.email ?? fieldRejection('email')} />
          </div>
          <div className="field">
            <label htmlFor="role">Rol</label>
            <select id="role" name="role" defaultValue={values?.role ?? ''}>
              <option value="">Sin rol</option>
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
            </select>
            <FieldError message={errors.role ?? fieldRejection('role')} />
          </div>
        </div>
        <div className="card-b invite-person__admin">
          <label className="invite-person__check">
            <input type="checkbox" name="isAdmin" defaultChecked={values?.isAdmin === 'on'} /> Admin de la cuenta: ve y gobierna a todo su equipo
          </label>
        </div>
      </section>
      <section className="card">
        <div className="card-b">
          <div className="field">
            <label htmlFor="reason">Motivo</label>
            <input id="reason" name="reason" required maxLength={REASON_MAX} defaultValue={values?.reason ?? ''} placeholder="Ej: lo pidió la admin por correo" />
            <small>Queda en la auditoría, en Gobernanza.</small>
            <FieldError message={errors.reason} />
          </div>
          <div className="invite-person__actions">
            <SubmitButton label="Invitar" busyLabel="Invitando…" name={SUBMIT_FIELD} value={SUBMIT_VALUE} />
            <Link className="btn ghost" to={`/client-users/${company.id}`}>Cancelar</Link>
          </div>
          {/* Después del botón principal: con Enter, el navegador usa el primer botón del formulario. */}
          {rejection && 'account' in rejection && <MoveFromPersonalNotice account={rejection.account} destination={company.name} canMove={canMove} />}
        </div>
      </section>
    </Form>
  );
}
