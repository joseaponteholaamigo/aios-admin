// El diálogo que confirma revocar un código (spec «Códigos de registro», CA-5): revocar no se deshace,
// así que no basta un clic. Dice el código, qué pasa con quienes ya lo canjearon (CB-14) y lleva su
// propio motivo; nada cambia hasta que se oprime el botón rojo.
import { useEffect, useId, useRef } from 'react';
import { Form, useLocation, useNavigation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton, submitState } from '../../../shared/ui/submit-button';
import { ACTION_LABELS } from '../code-labels';
import { REASON_MAX } from '../code-limits';
import './revoke-code-dialog.css';

type RevokeCodeDialogProps = {
  code: string;
  /** El campo con el que se manda la acción: el mismo del formulario de las otras acciones. */
  actionField: string;
  /** Lo que ya se había escrito como motivo en la tarjeta, para no perderlo. */
  reason: string;
  /** El rechazo del último intento de revocar este código, si lo hubo. */
  rejection: WriteRejection | null;
  onClose: () => void;
};

export function RevokeCodeDialog({ code, actionField, reason, rejection, onClose }: RevokeCodeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Modal: el resto de la página no se puede tocar mientras está abierto, y Esc lo cierra.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  // Mientras el pedido va en camino no se cierra: el aviso que llegue después quedaría sin su diálogo.
  const { busy } = submitState(useNavigation());
  // Sin la consulta: si no, el aviso de la acción anterior (`?aviso=…`) seguiría arriba del rechazo nuevo.
  const { pathname } = useLocation();
  const titleId = useId();
  const explanationId = useId();
  return (
    <dialog
      ref={ref} className="revoke-code-dialog" aria-labelledby={titleId} aria-describedby={explanationId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <Form method="post" action={pathname} className="revoke-code-dialog__form">
        <h2 id={titleId} className="revoke-code-dialog__title">¿Revocar <span className="mono">{code}</span>?</h2>
        <p id={explanationId}>Nadie más podrá reservarlo ni canjearlo, y no se puede reanudar. Quienes ya lo canjearon conservan su plan.</p>
        {rejection && <FormRejection rejection={rejection} />}
        <div className="field">
          <label htmlFor="revoke-reason">Motivo (opcional)</label>
          <input id="revoke-reason" name="reason" maxLength={REASON_MAX} defaultValue={reason} placeholder="Ej: se filtró en un foro" />
        </div>
        <div className="revoke-code-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton name={actionField} value="revoke" label="Revocar el código" busyLabel={ACTION_LABELS.revoke.busy} className="btn revoke-code-dialog__confirm" />
        </div>
      </Form>
    </dialog>
  );
}
