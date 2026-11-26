// El diálogo que revoca o reactiva una cuenta entera (spec «Revocar y reactivar una cuenta», CA-12 a CA-14). Al abrir
// pide la vista previa por detrás; dice qué pasa, pide el motivo y, al revocar, el id exacto de la cuenta. Nada cambia
// hasta que se oprime el botón. Va con fetchers: la vista previa no mueve la pantalla, y un rechazo se queda aquí.
import { useEffect, useId, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import type { AccountStatusAction } from '../../../domain/account-status';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import {
  PREVIEW_INTENT, REASON_MAX, SAVE_INTENT, STATUS_FIELDS, accountStatusHref, previewAllowsConfirm, type StatusAnswer,
} from '../account-status-form-data';
import { STATUS_ACTION_TEXTS, statusRejectionMessage } from '../account-status-labels';
import { AccountStatusPreview } from './account-status-preview';
import './account-status-dialog.css';

type AccountStatusDialogProps = {
  action: AccountStatusAction;
  companyId: string;
  /** Cómo se llama la cuenta en su ficha. */
  companyTitle: string;
  onClose: () => void;
};

export function AccountStatusDialog({ action, companyId, companyTitle, onClose }: AccountStatusDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const preview = useFetcher<StatusAnswer>();
  const save = useFetcher<StatusAnswer>();
  const [typed, setTyped] = useState('');
  const path = accountStatusHref(companyId);
  const titleId = useId();
  const introId = useId();
  // En una ref: si cambiara entre renders, el efecto volvería a pedir la vista previa en cada respuesta.
  const ask = useRef(preview.submit);
  ask.current = preview.submit;

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    void ask.current({ [STATUS_FIELDS.change]: action, [STATUS_FIELDS.intent]: PREVIEW_INTENT }, { method: 'post', action: path });
  }, [action, path]);

  // ⛔ Mientras el pedido va en camino no se cierra: el aviso o el rechazo que llegue quedaría sin su diálogo.
  const busy = save.state !== 'idle';
  const shown = preview.state === 'idle' ? preview.data : undefined;
  const failed = save.data && !save.data.ok ? save.data : null;
  const confirmed = action !== 'revoke' || typed === companyId;
  const t = STATUS_ACTION_TEXTS[action];
  return (
    <dialog
      ref={ref} className="account-status-dialog" aria-labelledby={titleId} aria-describedby={introId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <save.Form method="post" action={path} className="account-status-dialog__form">
        <h2 id={titleId} className="account-status-dialog__title">{t.title(companyTitle)}</h2>
        <AccountStatusPreview action={action} answer={shown} introId={introId} />
        {failed?.rejection && <FormRejection rejection={failed.rejection} message={statusRejectionMessage(failed.rejection, action, 'save')} />}
        <input type="hidden" name={STATUS_FIELDS.change} value={action} />
        <input type="hidden" name={STATUS_FIELDS.intent} value={SAVE_INTENT} />
        <div className="field">
          <label htmlFor="status-reason">Motivo</label>
          <textarea id="status-reason" name={STATUS_FIELDS.reason} required maxLength={REASON_MAX} className="account-status-dialog__reason" />
          <small>Queda en la auditoría del equipo. Ante el cliente firma «equipo-enso».</small>
          <FieldError message={failed?.errors.reason} />
        </div>
        {action === 'revoke' && (
          <div className="field">
            <label htmlFor="status-confirmation">Escribe <span className="mono">{companyId}</span> para confirmar</label>
            <input
              id="status-confirmation" name={STATUS_FIELDS.confirmation} autoComplete="off" spellCheck={false}
              value={typed} onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
        <div className="account-status-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton
            label={t.button} busyLabel={t.busy} pending={save} disabled={!confirmed || !previewAllowsConfirm(shown)}
            className={action === 'revoke' ? 'btn account-status-dialog__confirm' : 'btn primary'}
          />
        </div>
      </save.Form>
    </dialog>
  );
}
