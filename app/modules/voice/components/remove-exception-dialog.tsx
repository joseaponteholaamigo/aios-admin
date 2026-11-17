// El diálogo que confirma quitar la excepción del tope de la voz de una cuenta (spec «Registro abierto»
// de aios-tower, CA-33): dice a cuánto vuelve (el general), pide el motivo para la auditoría y nada
// cambia hasta que se oprime el botón. La cuenta va en el cuerpo del formulario, nunca en la dirección.
import { useEffect, useId, useRef } from 'react';
import { Form, useLocation, useNavigation } from 'react-router';
import type { VoiceCapException } from '../../../domain/voice-cap';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton, submitState } from '../../../shared/ui/submit-button';
import { INTENT_FIELD, REASON_MAX, type VoiceAttempt } from '../voice-form-data';
import { dollarsLabel } from '../voice-labels';
import './remove-exception-dialog.css';

type RemoveExceptionDialogProps = {
  exception: VoiceCapException;
  /** El tope general, al que vuelve la cuenta. */
  generalUsd: number;
  /** El último intento de quitar ESTA excepción que no se hizo, si lo hubo. */
  attempt: VoiceAttempt | null;
  onClose: () => void;
};

export function RemoveExceptionDialog({ exception, generalUsd, attempt, onClose }: RemoveExceptionDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Modal: el resto de la página no se puede tocar mientras está abierto, y Esc lo cierra.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  // Mientras el pedido va en camino no se cierra: el aviso que llegue después quedaría sin su diálogo.
  const { busy } = submitState(useNavigation());
  // Sin la consulta: si no, el aviso del cambio anterior (`?aviso=…`) seguiría arriba del rechazo nuevo.
  const { pathname } = useLocation();
  const titleId = useId();
  const explanationId = useId();
  const name = exception.accountName ?? exception.accountId;
  return (
    <dialog
      ref={ref} className="remove-exception-dialog" aria-labelledby={titleId} aria-describedby={explanationId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <Form method="post" action={pathname} className="remove-exception-dialog__form">
        <h2 id={titleId} className="remove-exception-dialog__title">¿Quitar la excepción de {name}?</h2>
        <p id={explanationId}>
          Hoy tiene un tope de {dollarsLabel(exception.usd)}. Sin la excepción vuelve al general: {dollarsLabel(generalUsd)} por persona al mes.
        </p>
        {attempt?.rejection && <FormRejection rejection={attempt.rejection} />}
        <FieldError message={attempt?.errors.accountId} />
        <input type="hidden" name="accountId" value={exception.accountId} />
        <div className="field">
          <label htmlFor="remove-exception-reason">Motivo</label>
          <input id="remove-exception-reason" name="reason" required maxLength={REASON_MAX} defaultValue={attempt?.values.reason ?? ''} placeholder="Queda en la auditoría" />
          <FieldError message={attempt?.errors.reason} />
        </div>
        <div className="remove-exception-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton name={INTENT_FIELD} value="remove-exception" label="Quitar la excepción" busyLabel="Quitando…" />
        </div>
      </Form>
    </dialog>
  );
}
