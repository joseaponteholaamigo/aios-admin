// Pausar, reanudar o revocar un código (spec «Códigos de registro», CA-5). Solo con «editar» en
// Códigos. Pausar y reanudar van con un clic; revocar no se deshace, así que abre su diálogo de
// confirmación. Quienes ya canjearon conservan su plan (CB-14).
import { useRef, useState } from 'react';
import { Form, useLocation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import { actionsFor, type CodeAction, type RegistrationCode } from '../../../domain/codes';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { ACTION_LABELS } from '../code-labels';
import { REASON_MAX } from '../code-limits';
import { RevokeCodeDialog } from './revoke-code-dialog';
import './code-actions.css';

export const ACTION_FIELD = 'accion';

type CodeActionsProps = {
  code: RegistrationCode;
  /** El rechazo del último intento, y de qué acción era: el de revocar se muestra en su diálogo. */
  rejection: WriteRejection | null;
  rejectedAction: CodeAction | null;
};

export function CodeActions({ code, rejection, rejectedAction }: CodeActionsProps) {
  const actions = actionsFor(code);
  // Abierto si el último intento de revocar se rechazó: el rechazo se lee donde se pidió.
  const [confirming, setConfirming] = useState(rejectedAction === 'revoke' && rejection !== null);
  const [reason, setReason] = useState('');
  const revokeButton = useRef<HTMLButtonElement>(null);
  const reasonInput = useRef<HTMLInputElement>(null);
  // Sin la consulta: si no, el aviso de la acción anterior (`?aviso=…`) seguiría arriba del rechazo nuevo.
  const { pathname } = useLocation();
  if (actions.length === 0) return null;
  const direct = actions.filter((a) => a !== 'revoke');
  return (
    <section className="card">
      <div className="card-h"><div><h2>Acciones</h2>
        <p>{code.pausedBy === 'brake' ? 'Lo pausó el freno del día: reanúdalo si las reservas son legítimas, o revócalo si se filtró.' : 'Pausado, nadie puede reservarlo; revocado, ya no vuelve.'}</p></div></div>
      <div className="card-b">
        {rejection && !confirming && <FormRejection rejection={rejection} />}
        {/* `key`: el formulario vuelve a nacer cuando el código cambia de estado. Si no, el motivo de
            la acción que ya se hizo seguiría escrito y viajaría a la auditoría de la siguiente. */}
        <Form key={code.status} method="post" action={pathname} className="code-actions">
          <div className="field">
            <label htmlFor="reason">Motivo (opcional)</label>
            <input ref={reasonInput} id="reason" name="reason" maxLength={REASON_MAX} placeholder="Para la auditoría del equipo" />
          </div>
          <div className="code-actions__buttons">
            {direct.map((action) => (
              <SubmitButton key={action} name={ACTION_FIELD} value={action} label={ACTION_LABELS[action].label} busyLabel={ACTION_LABELS[action].busy}
                className={action === 'resume' ? 'btn primary' : 'btn'} />
            ))}
            {actions.includes('revoke') && (
              <button ref={revokeButton} type="button" className="btn code-actions__revoke" onClick={() => { setReason(reasonInput.current?.value ?? ''); setConfirming(true); }}>
                {ACTION_LABELS.revoke.label}
              </button>
            )}
          </div>
        </Form>
      </div>
      {confirming && (
        <RevokeCodeDialog
          code={code.code} actionField={ACTION_FIELD} reason={reason}
          rejection={rejectedAction === 'revoke' ? rejection : null}
          onClose={() => { setConfirming(false); revokeButton.current?.focus(); }}
        />
      )}
    </section>
  );
}
