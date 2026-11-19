// Las personas de una cuenta con sus acciones (spec «Borrar cuentas y destrabar personas», CA-9 a
// CA-12): la tabla, y el diálogo de la acción elegida. Sin `canAct` es solo la tabla. Con `credits`,
// cada persona tiene además su botón de «Créditos» (spec «Créditos por persona» de aios-tower).
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { ClientPerson, ClientRole } from '../../../domain/client-users';
import { PERSON_ACTIONS, type PersonActionRequest } from '../../../domain/person-actions';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { PeopleTable } from './people-table';
import { PersonActionDialog } from './person-action-dialog';
import { PersonActionsMenu } from './person-actions-menu';
import { CreditsDialog } from './credits-dialog';
import './people-panel.css';

/** El último intento que el backend rechazó: vuelve a abrir su diálogo, con el rechazo. */
export type PersonActionAttempt = { attempt: PersonActionRequest | null; rejection: WriteRejection };

type PeoplePanelProps = {
  people: ClientPerson[];
  roles: ClientRole[];
  companyId: string;
  companyName: string;
  /** Una cuenta personal: su única persona no se borra sola (CB-4), se borra la cuenta. */
  personal: boolean;
  canAct: boolean;
  lastAttempt: PersonActionAttempt | null;
  /** Ver el saldo pide «ver» en Consumo; cargar, «editar» en Empresas. Sin ninguno, no hay botón. */
  credits: { canSee: boolean; canLoad: boolean };
};

const sameRequest = (a: PersonActionRequest | null, b: PersonActionRequest | null) =>
  Boolean(a && b && a.action === b.action && a.email === b.email);

/** Lo que se le puede hacer a una persona de una cuenta personal: todo menos borrarla. */
const PERSONAL_ACCOUNT_ACTIONS = PERSON_ACTIONS.filter((a) => a !== 'delete-person');

export function PeoplePanel({ people, roles, companyId, companyName, personal, canAct, lastAttempt, credits }: PeoplePanelProps) {
  const location = useLocation();
  const [chosen, setChosen] = useState<PersonActionRequest | null>(lastAttempt?.attempt ?? null);
  const [creditsOf, setCreditsOf] = useState<string | null>(null);
  const withCredits = credits.canSee || credits.canLoad;
  // El botón «Acciones» de la fila: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLElement | null>(null);
  // Al volver de una acción que salió bien (otra dirección) se cierra; si la rechazó, se reabre con el rechazo.
  useEffect(() => setChosen(lastAttempt?.attempt ?? null), [location.key, lastAttempt]);
  const rejection = lastAttempt && sameRequest(lastAttempt.attempt, chosen) ? lastAttempt.rejection : null;
  return (
    <>
      <PeopleTable
        people={people} roles={roles}
        actions={canAct || withCredits ? (person) => (
          <span className="people-panel__actions">
            {withCredits && (
              <button type="button" className="btn sm ghost" onClick={(e) => { trigger.current = e.currentTarget; setCreditsOf(person.email); }}>Créditos</button>
            )}
            {canAct && (
              <PersonActionsMenu
                actions={personal ? PERSONAL_ACCOUNT_ACTIONS : PERSON_ACTIONS}
                deleteAccountHref={personal ? `/companies/${encodeURIComponent(companyId)}/delete` : undefined}
                onChoose={(action, button) => { trigger.current = button; setChosen({ action, email: person.email }); }}
              />
            )}
          </span>
        ) : undefined}
      />
      {lastAttempt && !lastAttempt.attempt && <FormRejection rejection={lastAttempt.rejection} />}
      {creditsOf && (
        <CreditsDialog
          key={creditsOf} email={creditsOf} companyId={companyId} canSee={credits.canSee} canLoad={credits.canLoad}
          onClose={() => { setCreditsOf(null); trigger.current?.focus(); }}
        />
      )}
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
