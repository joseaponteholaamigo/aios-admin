// Los campos del diálogo «Cambiar rol» (spec «Editar cuentas y personas», CA-25): los roles de la
// empresa o «sin rol», y la casilla de admin, con lo que la persona tiene hoy puesto. El rol y el admin
// de hoy viajan ocultos para mandar solo lo que cambió.
import { useId } from 'react';
import type { ClientPerson, ClientRole } from '../../../domain/client-users';
import { ACTION_FIELDS } from '../../../shared/person-actions/person-action-form-data';
import { PersonReasonField } from './person-reason-field';
import './change-role-fields.css';

type ChangeRoleFieldsProps = {
  person: Pick<ClientPerson, 'role' | 'isAdmin'>;
  roles: ClientRole[];
  /** El motivo que se escribió antes de un rechazo. */
  reason: string;
};

export function ChangeRoleFields({ person, roles, reason }: ChangeRoleFieldsProps) {
  const roleId = useId();
  const current = person.role ?? '';
  // Un rol que ya no existe sigue a la vista como el de hoy: así no se cambia sin querer al guardar el admin.
  const missing = current !== '' && !roles.some((r) => r.slug === current);
  return (
    <>
      <input type="hidden" name={ACTION_FIELDS.currentRole} value={current} />
      <input type="hidden" name={ACTION_FIELDS.currentAdmin} value={String(person.isAdmin)} />
      <div className="field">
        <label htmlFor={roleId}>Rol</label>
        <select id={roleId} name={ACTION_FIELDS.role} defaultValue={current}>
          <option value="">Sin rol</option>
          {roles.map((r) => <option key={r.slug} value={r.slug}>{r.label}</option>)}
          {missing && <option value={current}>{current} (ya no existe)</option>}
        </select>
      </div>
      <label className="change-role-fields__check">
        <input type="checkbox" name={ACTION_FIELDS.isAdmin} defaultChecked={person.isAdmin} /> Admin de la cuenta: ve y gobierna a todo su equipo
      </label>
      <PersonReasonField defaultValue={reason} />
    </>
  );
}
