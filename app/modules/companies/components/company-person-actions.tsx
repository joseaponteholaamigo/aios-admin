// Lo que se le hace a la persona de una cuenta personal desde su ficha (spec «Editar cuentas y personas»,
// CA-1): sus «Créditos», para quien puede verlos o cargarlos, «Analítica y términos», para quien ve Usuarios de
// clientes (spec «Analítica de una persona», CA-10), y destrabarla, para el superadministrador. Abren los mismos
// diálogos y llaman a los mismos endpoints que en «Usuarios de clientes».
import { useRef, useState } from 'react';
import type { SeatStatus } from '../../../domain/client-users';
import type { PersonAction } from '../../../domain/person-actions';
import { analyticsChangeOffer, type AnalyticsAccess } from '../../../domain/person-analytics';
import { CreditsDialog } from '../../../shared/credits/credits-dialog';
import { PersonActionDialog } from '../../../shared/person-actions/person-action-dialog';
import type { PersonActionAttempt } from '../../../shared/person-actions/person-action-form-data';
import { personActionMenuLabel } from '../../../shared/person-actions/person-action-labels';
import { usePersonActionDialog } from '../../../shared/person-actions/use-person-action-dialog';
import { PersonAnalyticsDialog } from '../../../shared/person-analytics/person-analytics-dialog';
import { ANALYTICS_MENU_LABEL } from '../../../shared/person-analytics/person-analytics-labels';
import { FormRejection } from '../../../shared/ui/form-rejection';
import './company-person-actions.css';

type CompanyPersonActionsProps = {
  email: string;
  /** El estado de su asiento: a uno revocado no se le cambia la analítica. */
  seatStatus: SeatStatus;
  companyId: string;
  companyName: string;
  /** Las acciones que esta persona del equipo puede hacer aquí: ninguna si no es superadministradora. */
  actions: readonly PersonAction[];
  credits: { canSee: boolean; canLoad: boolean };
  analytics: AnalyticsAccess;
  lastAttempt: PersonActionAttempt | null;
};

export function CompanyPersonActions({ email, seatStatus, companyId, companyName, actions, credits, analytics, lastAttempt }: CompanyPersonActionsProps) {
  const dialog = usePersonActionDialog(lastAttempt);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const creditsTrigger = useRef<HTMLButtonElement>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const analyticsTrigger = useRef<HTMLButtonElement>(null);
  const withCredits = credits.canSee || credits.canLoad;
  if (!withCredits && !analytics.canSee && actions.length === 0) return null;
  return (
    <>
      <div className="company-person-actions">
        {withCredits && <button ref={creditsTrigger} type="button" className="btn sm" onClick={() => setCreditsOpen(true)}>Créditos</button>}
        {analytics.canSee && (
          <button ref={analyticsTrigger} type="button" className="btn sm" onClick={() => setAnalyticsOpen(true)}>{ANALYTICS_MENU_LABEL}</button>
        )}
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
      {analyticsOpen && (
        <PersonAnalyticsDialog
          email={email} companyId={companyId} change={analyticsChangeOffer(analytics, seatStatus)}
          onClose={() => { setAnalyticsOpen(false); analyticsTrigger.current?.focus(); }}
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
