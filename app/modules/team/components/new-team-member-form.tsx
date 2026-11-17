// «Nueva persona» del equipo ENSŌ (spec «Equipo ENSŌ», CA-15): correo, nombre, permisos y motivo.
// Lo escrito vuelve si el backend lo rechaza, con el error junto a su campo, y la clave es la misma en
// cada reintento: crear dos veces es crear una.
import { useState } from 'react';
import { Form, Link } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { TeamPermissions } from '../../../domain/team';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { NAME_MAX, REASON_MAX, TEAM_EMAIL_DOMAIN, splitPermissions, type FormValues } from '../team-form-data';
import { teamRejectionMessage } from '../team-labels';
import { PermissionsEditor } from './permissions-editor';
import './new-team-member-form.css';

/** Los campos que muestran su error. Un rechazo que nombra otro (o ninguno) va arriba del formulario. */
const PLACED_FIELDS = new Set(['email', 'name', 'reason', 'key', 'permissions']);

const fieldOf = (rejection: WriteRejection | null) => {
  const field = rejection?.code === 'invalid' ? rejection.field ?? null : null;
  return field && PLACED_FIELDS.has(field) ? field : null;
};

type Props = {
  formKey: string;
  values: FormValues | null;
  permissions: TeamPermissions;
  isSuperadmin: boolean;
  errors: Record<string, string>;
  rejection: WriteRejection | null;
};

export function NewTeamMemberForm({ formKey, values, permissions, isSuperadmin: initialSuper, errors, rejection }: Props) {
  const [value, setValue] = useState(splitPermissions(permissions).shown);
  const [isSuperadmin, setSuperadmin] = useState(initialSuper);
  const field = fieldOf(rejection);
  const errorOf = (name: string) => errors[name] ?? (rejection && field === name ? teamRejectionMessage(rejection) : null);
  const text = (name: string) => values?.[name] ?? '';
  return (
    <Form method="post" className="grid">
      <input type="hidden" name="key" value={formKey} />
      {rejection?.code === 'already-in-team' && (
        <div className="banner" role="alert">
          <p>
            Esa persona ya está en el equipo.{' '}
            {rejection.sub && <Link to={`/team/${encodeURIComponent(rejection.sub)}`}>Ver su página</Link>}
          </p>
        </div>
      )}
      {rejection && rejection.code !== 'already-in-team' && !field && <FormRejection rejection={rejection} message={teamRejectionMessage(rejection)} />}
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 1</span><h2>Quién es</h2>
          <p>Le llega un correo con una contraseña temporal; al entrar, vincula su app de códigos.</p></div></div>
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" required defaultValue={text('email')} placeholder={`nombre@${TEAM_EMAIL_DOMAIN}`} autoComplete="off" />
            <small>Solo correos @{TEAM_EMAIL_DOMAIN}.</small>
            <FieldError message={errorOf('email')} />
          </div>
          <div className="field">
            <label htmlFor="name">Nombre (opcional)</label>
            <input id="name" name="name" maxLength={NAME_MAX} defaultValue={text('name')} placeholder="Nati" />
            <FieldError message={errorOf('name')} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 2</span><h2>Qué puede hacer</h2>
          <p>A qué módulos entra y con qué nivel. Lo puedes cambiar después.</p></div></div>
        <div className="card-b">
          <PermissionsEditor value={value} hidden={{}} isSuperadmin={isSuperadmin} onChange={setValue} onSuperadminChange={setSuperadmin} />
          <FieldError message={errorOf('permissions')} />
        </div>
      </section>
      <section className="card">
        <div className="card-b grid">
          <div className="field">
            <label htmlFor="reason">Motivo</label>
            <input id="reason" name="reason" required maxLength={REASON_MAX} defaultValue={text('reason')} placeholder="Queda en la historia de la persona" />
            <FieldError message={errorOf('reason')} />
          </div>
          <FieldError message={errorOf('key')} />
          <div className="team-new__actions">
            <SubmitButton label="Crear" busyLabel="Creando…" />
            <Link className="btn ghost" to="/team">Cancelar</Link>
          </div>
        </div>
      </section>
    </Form>
  );
}
