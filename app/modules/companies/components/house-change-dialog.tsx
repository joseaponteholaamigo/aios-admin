// El diálogo que quita la pausa de la casa o descongela un lote (spec «Reanudar la casa de una cuenta», CA-13 y CA-14).
// Dice qué hace y qué no: quitar la pausa no descongela créditos; descongelar corresponde solo si la plata volvió, y no
// quita la pausa. Pide un motivo opcional. Va con un fetcher: guardar vuelve a la ficha con el aviso, y un rechazo se
// queda aquí con el botón disponible otra vez. El correo y el lote viajan en el cuerpo, nunca en la dirección.
import { useEffect, useId, useRef } from 'react';
import { useFetcher } from 'react-router';
import type { HouseReview, HouseTarget } from '../../../domain/house';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { HOUSE_FIELDS, REASON_MAX, houseHref, type HouseAnswer } from '../house-form-data';
import { HOUSE_ACTION_TEXTS, REASON_HINT, houseDialogTexts, houseRejectionMessage } from '../house-labels';
import './house-change-dialog.css';

type HouseChangeDialogProps = {
  target: HouseTarget;
  /** La casa como la mostró la ficha: dice si sigue la pausa y cuántos lotes quedan congelados. */
  house: HouseReview;
  companyId: string;
  /** Cómo se llama la cuenta en su ficha. */
  companyTitle: string;
  onClose: () => void;
};

export function HouseChangeDialog({ target, house, companyId, companyTitle, onClose }: HouseChangeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const save = useFetcher<HouseAnswer>();
  const titleId = useId();
  const introId = useId();
  const reasonId = useId();

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  // ⛔ Mientras el pedido va en camino no se cierra: el aviso o el rechazo que llegue quedaría sin su diálogo.
  const busy = save.state !== 'idle';
  const failed = save.state === 'idle' ? save.data : undefined;
  const texts = houseDialogTexts(target, house, companyTitle);
  const t = HOUSE_ACTION_TEXTS[target.action];
  return (
    <dialog
      ref={ref} className="house-change-dialog" aria-labelledby={titleId} aria-describedby={introId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <save.Form method="post" action={houseHref(companyId)} className="house-change-dialog__form">
        <h2 id={titleId} className="house-change-dialog__title">{texts.title}</h2>
        <p id={introId}>{texts.intro}</p>
        {texts.facts.map((fact) => (
          <p key={fact.text} className={fact.tone === 'warn' ? 'house-change-dialog__warn' : undefined}>{fact.text}</p>
        ))}
        {failed?.rejection && <FormRejection rejection={failed.rejection} message={houseRejectionMessage(failed.rejection, target.action)} />}
        <input type="hidden" name={HOUSE_FIELDS.change} value={target.action} />
        {target.action === 'unfreeze' && (
          <>
            <input type="hidden" name={HOUSE_FIELDS.email} value={target.lot.email} />
            <input type="hidden" name={HOUSE_FIELDS.lot} value={target.lot.lotId} />
          </>
        )}
        <div className="field">
          <label htmlFor={reasonId}>Motivo (opcional)</label>
          <textarea id={reasonId} name={HOUSE_FIELDS.reason} maxLength={REASON_MAX} className="house-change-dialog__reason" placeholder={t.placeholder} />
          <small>{REASON_HINT}</small>
          <FieldError message={failed?.errors.reason} />
        </div>
        <div className="house-change-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton label={t.button} busyLabel={t.busy} pending={save} />
        </div>
      </save.Form>
    </dialog>
  );
}
