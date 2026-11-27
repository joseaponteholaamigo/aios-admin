// Las personas de una cuenta con sus acciones (spec «Borrar cuentas y destrabar personas», CA-9 a
// CA-12, y spec «Editar cuentas y personas», CA-24 a CA-26): la tabla, y el diálogo de la acción
// elegida. Cada persona ofrece solo lo que `actor` puede hacerle según su asiento. Con `credits`, cada
// persona tiene además su botón de «Créditos» (spec «Créditos por persona» de aios-tower).
import { useRef, useState } from 'react';
import type { ClientPerson, ClientRole } from '../../../domain/client-users';
import { personActionsFor, type PersonActionRequest, type PersonActionsActor } from '../../../domain/person-actions';
import { CreditsDialog } from '../../../shared/credits/credits-dialog';
import { PersonActionDialog } from '../../../shared/person-actions/person-action-dialog';
import type { PersonActionAttempt } from '../../../shared/person-actions/person-action-form-data';
import { usePersonActionDialog } from '../../../shared/person-actions/use-person-action-dialog';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { ChangeRoleFields } from './change-role-fields';
import { PeopleTable } from './people-table';
import { PersonActionsMenu } from './person-actions-menu';
import { PersonReasonField } from './person-reason-field';
import './people-panel.css';

type PeoplePanelProps = {
  people: ClientPerson[];
  roles: ClientRole[];
  companyId: string;
  companyName: string;
  /** Una cuenta personal: su única persona no se borra sola (CB-4), se borra la cuenta; ni se le cambia el rol (CA-24). */
  personal: boolean;
  actor: PersonActionsActor;
  lastAttempt: PersonActionAttempt | null;
  /** Ver el saldo pide «ver» en Consumo; cargar, «editar» en Empresas. Sin ninguno, no hay botón. */
  credits: { canSee: boolean; canLoad: boolean };
};

/** El motivo que mandó el intento rechazado, para no tener que escribirlo de nuevo. */
const reasonOf = (attempt: PersonActionRequest | null) => (attempt && 'reason' in attempt ? attempt.reason : '');

export function PeoplePanel({ people, roles, companyId, companyName, personal, actor, lastAttempt, credits }: PeoplePanelProps) {
  const dialog = usePersonActionDialog(lastAttempt);
  const [creditsOf, setCreditsOf] = useState<string | null>(null);
  const creditsTrigger = useRef<HTMLElement | null>(null);
  const withCredits = credits.canSee || credits.canLoad;
  // En una cuenta personal, el superadministrador ve también «Borrar cuenta» en el menú.
  const deleteAccountHref = personal && actor.superadmin ? `/companies/${encodeURIComponent(companyId)}/delete` : undefined;
  const chosenPerson = dialog.chosen ? people.find((p) => p.email === dialog.chosen?.email) ?? null : null;
  const anyActions = people.some((p) => personActionsFor(p.status, personal, actor).length > 0) || Boolean(deleteAccountHref);
  return (
    <>
      <PeopleTable
        people={people} roles={roles}
        actions={anyActions || withCredits ? (person) => {
          const actions = personActionsFor(person.status, personal, actor);
          return (
            <span className="people-panel__actions">
              {withCredits && (
                <button type="button" className="btn sm ghost" onClick={(e) => { creditsTrigger.current = e.currentTarget; setCreditsOf(person.email); }}>Créditos</button>
              )}
              {(actions.length > 0 || deleteAccountHref) && (
                <PersonActionsMenu actions={actions} deleteAccountHref={deleteAccountHref} onChoose={(action, button) => dialog.open(action, person.email, button)} />
              )}
            </span>
          );
        } : undefined}
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
        >
          {dialog.chosen.action === 'change-role' && chosenPerson && <ChangeRoleFields person={chosenPerson} roles={roles} reason={reasonOf(dialog.attempt)} />}
          {dialog.chosen.action === 'revoke' && <PersonReasonField defaultValue={reasonOf(dialog.attempt)} />}
        </PersonActionDialog>
      )}
    </>
  );
}
