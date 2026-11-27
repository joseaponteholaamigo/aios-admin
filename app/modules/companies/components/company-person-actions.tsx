// Lo que se le hace a la persona de una cuenta personal desde su ficha (spec «Editar cuentas y personas»,
// CA-1): sus «Créditos», para quien puede verlos o cargarlos, y destrabarla, para el superadministrador.
// Abren los mismos diálogos y llaman a los mismos endpoints que en «Usuarios de clientes».
import { useRef, useState } from 'react';
import type { PersonAction } from '../../../domain/person-actions';
import { CreditsDialog } from '../../../shared/credits/credits-dialog';
import { PersonActionDialog } from '../../../shared/person-actions/person-action-dialog';
import type { PersonActionAttempt } from '../../../shared/person-actions/person-action-form-data';
import { personActionMenuLabel } from '../../../shared/person-actions/person-action-labels';
import { usePersonActionDialog } from '../../../shared/person-actions/use-person-action-dialog';
import { FormRejection } from '../../../shared/ui/form-rejection';
import './company-person-actions.css';

type CompanyPersonActionsProps = {
  email: string;
  companyId: string;
  companyName: string;
  /** Las acciones que esta persona del equipo puede hacer aquí: ninguna si no es superadministradora. */
  actions: readonly PersonAction[];
  credits: { canSee: boolean; canLoad: boolean };
  lastAttempt: PersonActionAttempt | null;
};

export function CompanyPersonActions({ email, companyId, companyName, actions, credits, lastAttempt }: CompanyPersonActionsProps) {
  const dialog = usePersonActionDialog(lastAttempt);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const creditsTrigger = useRef<HTMLButtonElement>(null);
  const withCredits = credits.canSee || credits.canLoad;
  if (!withCredits && actions.length === 0) return null;
  return (
    <>
      <div className="company-person-actions">
        {withCredits && <button ref={creditsTrigger} type="button" className="btn sm" onClick={() => setCreditsOpen(true)}>Créditos</button>}
        {actions.map((action) => (
          <button key={action} type="button" className="btn sm ghost" onClick={(e) => dialog.open(action, email, e.currentTarget)}>
            {personActionMenuLabel[action]}
          </button>
        ))}
      </div>
      {lastAttempt && !lastAttempt.attempt && <FormRejection rejection={lastAttempt.rejection} />}
      {creditsOpen && (
        <CreditsDialog
          email={email} companyId={companyId} canSee={credits.canSee} canLoad={credits.canLoad}
          onClose={() => { setCreditsOpen(false); creditsTrigger.current?.focus(); }}
        />
      )}
      {dialog.chosen && (
        <PersonActionDialog
          key={dialog.chosen.action} action={dialog.chosen.action} email={dialog.chosen.email} companyName={companyName}
          rejection={dialog.rejection} onClose={dialog.close}
        />
      )}
    </>
  );
}
