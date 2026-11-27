// El diálogo que pasa una empresa a cuenta personal, o al revés (spec «Pasar una empresa a cuenta personal, y al
// revés», CA-12 a CA-14). Al abrir pide la vista previa por detrás y dice qué cambia; si el backend dice que no puede,
// lo dice con qué hacer y no ofrece guardar. Pide un motivo opcional. Nada cambia hasta que se oprime «Guardar». Va con
// fetchers: la vista previa no mueve la pantalla, y un rechazo se queda aquí con el botón disponible otra vez.
import { useEffect, useId, useRef } from 'react';
import { useFetcher } from 'react-router';
import type { AccountKind } from '../../../domain/companies';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { PREVIEW_INTENT, REASON_MAX, SAVE_INTENT, TYPE_FIELDS, accountTypeHref, saveOfferOf, type TypeAnswer } from '../account-type-form-data';
import { TYPE_ACTION_TEXTS, TYPE_SAVE_TEXTS, typeRejectionMessage } from '../account-type-labels';
import { AccountTypePreview } from './account-type-preview';
import './account-type-dialog.css';

type AccountTypeDialogProps = {
  /** El tipo al que pasa. */
  target: AccountKind;
  companyId: string;
  /** Cómo se llama la cuenta en su ficha. */
  companyTitle: string;
  onClose: () => void;
};

export function AccountTypeDialog({ target, companyId, companyTitle, onClose }: AccountTypeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const preview = useFetcher<TypeAnswer>();
  const save = useFetcher<TypeAnswer>();
  const path = accountTypeHref(companyId);
  const titleId = useId();
  const introId = useId();
  const reasonId = useId();
  // En una ref: si cambiara entre renders, el efecto volvería a pedir la vista previa en cada respuesta.
  const ask = useRef(preview.submit);
  ask.current = preview.submit;

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    void ask.current({ [TYPE_FIELDS.kind]: target, [TYPE_FIELDS.intent]: PREVIEW_INTENT }, { method: 'post', action: path });
  }, [target, path]);

  // ⛔ Mientras el pedido va en camino no se cierra: el aviso o el rechazo que llegue quedaría sin su diálogo.
  const busy = save.state !== 'idle';
  const shown = preview.state === 'idle' ? preview.data : undefined;
  const failed = save.data && !save.data.ok ? save.data : null;
  // Mientras llega la vista previa, el motivo y «Guardar» se ven (desactivado); si dice que no, no se ofrecen (CA-13).
  const offer = saveOfferOf(shown);
  const offered = offer !== 'none';
  return (
    <dialog
      ref={ref} className="account-type-dialog" aria-labelledby={titleId} aria-describedby={introId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <save.Form method="post" action={path} className="account-type-dialog__form">
        <h2 id={titleId} className="account-type-dialog__title">{TYPE_ACTION_TEXTS[target].title(companyTitle)}</h2>
        <AccountTypePreview target={target} answer={shown} introId={introId} />
        {failed?.rejection && <FormRejection rejection={failed.rejection} message={typeRejectionMessage(failed.rejection, 'save')} />}
        <input type="hidden" name={TYPE_FIELDS.kind} value={target} />
        <input type="hidden" name={TYPE_FIELDS.intent} value={SAVE_INTENT} />
        {offered && (
          <div className="field">
            <label htmlFor={reasonId}>Motivo (opcional)</label>
            <textarea id={reasonId} name={TYPE_FIELDS.reason} maxLength={REASON_MAX} className="account-type-dialog__reason" />
            <small>Queda en la auditoría del equipo. Ante el cliente firma «equipo-enso».</small>
            <FieldError message={failed?.errors.reason} />
          </div>
        )}
        <div className="account-type-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>{offered ? 'Cancelar' : 'Cerrar'}</button>
          {offered && <SubmitButton label={TYPE_SAVE_TEXTS.button} busyLabel={TYPE_SAVE_TEXTS.busy} pending={save} disabled={offer !== 'ready'} />}
        </div>
      </save.Form>
    </dialog>
  );
}
