// Las personas de una cuenta con sus acciones (spec «Borrar cuentas y destrabar personas», CA-9 a
// CA-12): la tabla, y el diálogo de la acción elegida. Sin `canAct` es solo la tabla. Con `credits`,
// cada persona tiene además su botón de «Créditos» (spec «Créditos por persona» de aios-tower).
import { useRef, useState } from 'react';
import type { ClientPerson, ClientRole } from '../../../domain/client-users';
import { PERSON_ACTIONS, PERSONAL_ACCOUNT_ACTIONS } from '../../../domain/person-actions';
import { CreditsDialog } from '../../../shared/credits/credits-dialog';
import { PersonActionDialog } from '../../../shared/person-actions/person-action-dialog';
import type { PersonActionAttempt } from '../../../shared/person-actions/person-action-form-data';
import { usePersonActionDialog } from '../../../shared/person-actions/use-person-action-dialog';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { PeopleTable } from './people-table';
import { PersonActionsMenu } from './person-actions-menu';
import './people-panel.css';

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

export function PeoplePanel({ people, roles, companyId, companyName, personal, canAct, lastAttempt, credits }: PeoplePanelProps) {
  const dialog = usePersonActionDialog(lastAttempt);
  const [creditsOf, setCreditsOf] = useState<string | null>(null);
  const creditsTrigger = useRef<HTMLElement | null>(null);
  const withCredits = credits.canSee || credits.canLoad;
  return (
    <>
      <PeopleTable
        people={people} roles={roles}
        actions={canAct || withCredits ? (person) => (
          <span className="people-panel__actions">
            {withCredits && (
              <button type="button" className="btn sm ghost" onClick={(e) => { creditsTrigger.current = e.currentTarget; setCreditsOf(person.email); }}>Créditos</button>
            )}
            {canAct && (
              <PersonActionsMenu
                actions={personal ? PERSONAL_ACCOUNT_ACTIONS : PERSON_ACTIONS}
                deleteAccountHref={personal ? `/companies/${encodeURIComponent(companyId)}/delete` : undefined}
                onChoose={(action, button) => dialog.open(action, person.email, button)}
              />
            )}
          </span>
        ) : undefined}
      />
      {lastAttempt && !lastAttempt.attempt && <FormRejection rejection={lastAttempt.rejection} />}
      {creditsOf && (
        <CreditsDialog
          key={creditsOf} email={creditsOf} companyId={companyId} canSee={credits.canSee} canLoad={credits.canLoad}
          onClose={() => { setCreditsOf(null); creditsTrigger.current?.focus(); }}
        />
      )}
      {dialog.chosen && (
        <PersonActionDialog
          key={`${dialog.chosen.action}:${dialog.chosen.email}`}
          action={dialog.chosen.action} email={dialog.chosen.email} companyName={companyName}
          rejection={dialog.rejection} onClose={dialog.close}
        />
      )}
    </>
  );
}
