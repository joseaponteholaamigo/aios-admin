// Las personas de una cuenta con sus acciones (spec «Borrar cuentas y destrabar personas», CA-9 a
// CA-12): la tabla, y el diálogo de la acción elegida. Sin `canAct` es solo la tabla.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { ClientPerson, ClientRole } from '../../../domain/client-users';
import type { PersonActionRequest } from '../../../domain/person-actions';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { PeopleTable } from './people-table';
import { PersonActionDialog } from './person-action-dialog';
import { PersonActionsMenu } from './person-actions-menu';

/** El último intento que el backend rechazó: vuelve a abrir su diálogo, con el rechazo. */
export type PersonActionAttempt = { attempt: PersonActionRequest | null; rejection: WriteRejection };

type PeoplePanelProps = {
  people: ClientPerson[];
  roles: ClientRole[];
  companyName: string;
  canAct: boolean;
  lastAttempt: PersonActionAttempt | null;
};

const sameRequest = (a: PersonActionRequest | null, b: PersonActionRequest | null) =>
  Boolean(a && b && a.action === b.action && a.email === b.email);

export function PeoplePanel({ people, roles, companyName, canAct, lastAttempt }: PeoplePanelProps) {
  const location = useLocation();
  const [chosen, setChosen] = useState<PersonActionRequest | null>(lastAttempt?.attempt ?? null);
  // El botón «Acciones» de la fila: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLElement | null>(null);
  // Al volver de una acción que salió bien (otra dirección) se cierra; si la rechazó, se reabre con el rechazo.
  useEffect(() => setChosen(lastAttempt?.attempt ?? null), [location.key, lastAttempt]);
  const rejection = lastAttempt && sameRequest(lastAttempt.attempt, chosen) ? lastAttempt.rejection : null;
  return (
    <>
      <PeopleTable
        people={people} roles={roles}
        actions={canAct ? (person) => (
          <PersonActionsMenu onChoose={(action, button) => { trigger.current = button; setChosen({ action, email: person.email }); }} />
        ) : undefined}
      />
      {lastAttempt && !lastAttempt.attempt && <FormRejection rejection={lastAttempt.rejection} />}
      {chosen && (
        <PersonActionDialog
          key={`${chosen.action}:${chosen.email}`}
          action={chosen.action} email={chosen.email} companyName={companyName}
          rejection={rejection} onClose={() => { setChosen(null); trigger.current?.focus(); }}
        />
      )}
    </>
  );
}
