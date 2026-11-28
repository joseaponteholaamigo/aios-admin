// El diálogo que confirma quitar la clave de la casa de un servicio (spec «Compartir referentes» de aios-tower,
// D20 y CA-39): dice qué se corta, que la clave sigue viva en el proveedor hasta revocarla allá, y pide el
// motivo para la auditoría. Nada cambia hasta que se oprime el botón rojo.
import { useEffect, useId, useRef } from 'react';
import { Form, useLocation, useNavigation } from 'react-router';
import type { HouseKeyService } from '../../../domain/house-keys';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton, submitState } from '../../../shared/ui/submit-button';
import { FIELDS, INTENT_FIELD, REASON_MAX, type HouseKeyAttempt } from '../house-key-form-data';
import { SERVICE_INFO } from '../house-keys-labels';
import './remove-key-dialog.css';

type RemoveKeyDialogProps = {
  service: HouseKeyService;
  /** El último intento de quitarla que no se hizo, si lo hubo. */
  attempt: HouseKeyAttempt | null;
  onClose: () => void;
};

export function RemoveKeyDialog({ service, attempt, onClose }: RemoveKeyDialogProps) {
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
  const { name, uses } = SERVICE_INFO[service];
  return (
    <dialog
      ref={ref} className="remove-key-dialog" aria-labelledby={titleId} aria-describedby={explanationId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <Form method="post" action={pathname} className="remove-key-dialog__form">
        <h2 id={titleId} className="remove-key-dialog__title">¿Quitar la clave de {name}?</h2>
        <p id={explanationId}>
          La clave queda vacía y {name} apagado: {uses} se cortan para todas las cuentas al instante, hasta que alguien ponga una clave nueva.
        </p>
        <p>Quitarla aquí no la anula en {name}: si se filtró, revócala también en su panel.</p>
        {attempt?.rejection && <FormRejection rejection={attempt.rejection} />}
        <div className="field">
          <label htmlFor="remove-key-reason">Motivo</label>
          <input id="remove-key-reason" name={FIELDS.reason} required maxLength={REASON_MAX} defaultValue={attempt?.values.reason ?? ''} placeholder="Ej: la clave se filtró" />
          <small>Queda en la auditoría, en Gobernanza.</small>
          <FieldError message={attempt?.errors.reason} />
        </div>
        <div className="remove-key-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cancelar</button>
          <SubmitButton name={INTENT_FIELD} value="remove" label="Quitar la clave" busyLabel="Quitando…" className="btn remove-key-dialog__confirm" />
        </div>
      </Form>
    </dialog>
  );
}
