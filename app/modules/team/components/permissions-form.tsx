// Cambiar los permisos de una persona del equipo (spec «Equipo ENSŌ», CA-17): el editor, el motivo y
// «Guardar permisos», que está desactivado mientras nada cambió.
import { useState } from 'react';
import { Form, useLocation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { TeamPermissions, TeamPerson } from '../../../domain/team';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { INTENT_FIELD, REASON_MAX, VERSION_FIELD, splitPermissions } from '../team-form-data';
import { teamRejectionMessage } from '../team-labels';
import { PermissionsEditor } from './permissions-editor';

const sameMap = (a: TeamPermissions, b: TeamPermissions) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

type Props = { person: TeamPerson; reasonError: string | null; rejection: WriteRejection | null };

export function PermissionsForm({ person, reasonError, rejection }: Props) {
  const { shown, hidden } = splitPermissions(person.permissions);
  const [value, setValue] = useState(shown);
  const [isSuperadmin, setSuperadmin] = useState(person.isSuperadmin);
  const changed = !sameMap(value, shown) || isSuperadmin !== person.isSuperadmin;
  const { pathname } = useLocation();
  return (
    <section className="card">
      <div className="card-h"><div><h2>Permisos</h2><p>A qué módulos entra y con qué nivel. Valen desde su siguiente pedido.</p></div></div>
      <div className="card-b">
        <Form method="post" action={pathname} className="grid">
          <input type="hidden" name={INTENT_FIELD} value="permissions" />
          <input type="hidden" name={VERSION_FIELD} value={person.version ?? ''} />
          {rejection && <FormRejection rejection={rejection} message={teamRejectionMessage(rejection)} />}
          <PermissionsEditor value={value} hidden={hidden} isSuperadmin={isSuperadmin} onChange={setValue} onSuperadminChange={setSuperadmin} />
          <div className="field">
            <label htmlFor="permissions-reason">Motivo</label>
            <input id="permissions-reason" name="reason" required maxLength={REASON_MAX} placeholder="Queda en la historia de la persona" />
            <FieldError message={reasonError} />
          </div>
          <div><SubmitButton label="Guardar permisos" busyLabel="Guardando…" disabled={!changed} /></div>
        </Form>
      </div>
    </section>
  );
}
