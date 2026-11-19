// El diálogo que confirma una acción sobre una persona (spec «Borrar cuentas y destrabar personas»,
// CA-10 y CA-12): con su correo, qué le va a pasar, «Cancelar» y el botón de la acción. Nada cambia
// hasta que se oprime el botón. El correo va en el cuerpo del formulario, nunca en la dirección.
import { useEffect, useId, useRef } from 'react';
import { Form, useLocation, useNavigation } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { PersonAction } from '../../../domain/person-actions';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton, submitState } from '../../../shared/ui/submit-button';
import { personActionRejectionMessage, personActionTexts } from '../person-action-labels';
import './person-action-dialog.css';

type PersonActionDialogProps = {
  action: PersonAction;
  email: string;
  companyName: string;
  /** El rechazo del último intento de ESTA acción sobre ESTA persona, si lo hubo. */
  rejection: WriteRejection | null;
  onClose: () => void;
};

export function PersonActionDialog({ action, email, companyName, rejection, onClose }: PersonActionDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Modal: el resto de la página no se puede tocar mientras el diálogo está abierto, y Esc lo cierra.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const t = personActionTexts(action, email, companyName);
  // ⛔ Mientras el pedido va en camino no se cierra: cerrado, se podría abrir el de otra persona y el
  // aviso que llegue después se leería como de esa otra (CA-10).
  const { busy } = submitState(useNavigation());
  // Sin la consulta: si no, el aviso de la acción anterior (`?persona=…`) seguiría arriba del rechazo nuevo.
  const { pathname } = useLocation();
  const titleId = useId();
  const explanationId = useId();
  return (
    <dialog
      ref={ref} className="person-action-dialog" aria-labelledby={titleId} aria-describedby={explanationId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <Form method="post" action={pathname} className="person-action-dialog__form">
        <h2 id={titleId} className="person-action-dialog__title">{t.title}</h2>
        <p id={explanationId}>{t.explanation}</p>
        {t.check && <p className="person-action-dialog__check">{t.check}</p>}
        {rejection && <FormRejection rejection={rejection} message={personActionRejectionMessage(rejection)} />}
        <input type="hidden" name="intent" value={action} />
        <input type="hidden" name="email" value={email} />
        <div className="person-action-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton label={t.confirm} busyLabel={t.busy} className="btn person-action-dialog__confirm" />
        </div>
      </Form>
    </dialog>
  );
}
