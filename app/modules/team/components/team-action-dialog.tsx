// El diálogo que confirma una acción sobre una persona del equipo (spec «Equipo ENSŌ», CA-18): qué
// va a pasar, el motivo y el botón de la acción. Nada cambia hasta que se oprime el botón.
import { useEffect, useId, useRef } from 'react';
import { Form, useLocation, useNavigation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { TeamAction } from '../../../domain/team';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton, submitState } from '../../../shared/ui/submit-button';
import { ACTION_TEXTS, teamRejectionMessage } from '../team-labels';
import { INTENT_FIELD, REASON_MAX } from '../team-form-data';
import './team-action-dialog.css';

type Props = { action: TeamAction; name: string; rejection: WriteRejection | null; onClose: () => void };

export function TeamActionDialog({ action, name, rejection, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  // Mientras el pedido va en camino no se cierra: el aviso que llegue después quedaría sin su diálogo.
  const { busy } = submitState(useNavigation());
  // Sin la consulta: si no, el aviso de lo anterior (`?aviso=…`) seguiría arriba del rechazo nuevo.
  const { pathname } = useLocation();
  const t = ACTION_TEXTS[action];
  const titleId = useId();
  const explanationId = useId();
  return (
    <dialog
      ref={ref} className="team-action-dialog" aria-labelledby={titleId} aria-describedby={explanationId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <Form method="post" action={pathname} className="team-action-dialog__form">
        <h2 id={titleId} className="team-action-dialog__title">{t.title(name)}</h2>
        <p id={explanationId}>{t.explanation}</p>
        {rejection && <FormRejection rejection={rejection} message={teamRejectionMessage(rejection)} />}
        <input type="hidden" name={INTENT_FIELD} value={action} />
        <div className="field">
          <label htmlFor="action-reason">Motivo</label>
          <input id="action-reason" name="reason" required maxLength={REASON_MAX} placeholder="Queda en la historia de la persona" />
        </div>
        <div className="team-action-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton label={t.confirm} busyLabel={t.busy} className={t.danger ? 'btn team-action-dialog__danger' : 'btn primary'} />
        </div>
      </Form>
    </dialog>
  );
}
