// La confirmación del borrado de una cuenta (spec «Borrar cuentas y destrabar personas», CA-24, CA-26
// y CA-27). El botón queda apagado hasta que lo escrito sea el id exacto; una cuenta que cobra no lo
// muestra; un borrado a medias lo ofrece como «Terminar el borrado», que repite el mismo pedido.
import { useState } from 'react';
import { Form } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { DeletionPreview } from '../../../domain/account-deletion';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import './delete-account-form.css';

type DeleteAccountFormProps = {
  preview: DeletionPreview;
  values: { confirmation: string; reason: string } | null;
  rejection: WriteRejection | null;
};

/**
 * Un 404 al borrar casi siempre es que el borrado anterior terminó aunque la respuesta no llegó: la API
 * corta a los 30 s y la función alcanzó a terminar (CB-20). Repetir no hace daño, pero hay que decirlo.
 */
const ALREADY_GONE = 'La cuenta ya no existe: puede que un borrado anterior haya terminado. Vuelve a Empresas para confirmarlo.';

/** El tope del motivo, el mismo del backend (`LARGO_DEL_MOTIVO`). */
const MAX_REASON_LENGTH = 500;

export function DeleteAccountForm({ preview, values, rejection }: DeleteAccountFormProps) {
  const { id } = preview.company;
  const [typed, setTyped] = useState(values?.confirmation ?? '');
  if (preview.charging) {
    return (
      <div className="banner" role="alert">
        <p>Esta cuenta tiene una suscripción de Stripe que no está cancelada y puede volver a cobrar. Primero hay que cancelarla en Stripe; después se puede borrar desde aquí.</p>
      </div>
    );
  }
  const unfinished = preview.pending || rejection?.code === 'deletion-incomplete';
  return (
    <Form method="post" className="card pad delete-account-form">
      {unfinished && <p className="delete-account-form__unfinished">Un borrado anterior de esta cuenta no terminó. «Terminar el borrado» borra lo que falta.</p>}
      {rejection && <FormRejection rejection={rejection} message={rejection.code === 'not-found' ? ALREADY_GONE : undefined} />}
      <div className="field">
        <label htmlFor="delete-reason">Motivo (opcional)</label>
        <textarea id="delete-reason" name="reason" maxLength={MAX_REASON_LENGTH} defaultValue={values?.reason ?? ''} className="delete-account-form__reason" />
        <small>Queda en la auditoría del equipo. Es lo único que sobrevive al borrado.</small>
      </div>
      <div className="field">
        <label htmlFor="delete-confirmation">Escribe <span className="mono">{id}</span> para confirmar</label>
        <input id="delete-confirmation" name="confirmation" autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <p className="delete-account-form__warning">Se borran la cuenta, sus personas y sus logins. No se puede deshacer y no se le avisa a nadie.</p>
      <SubmitButton
        label={unfinished ? 'Terminar el borrado' : 'Borrar cuenta'} busyLabel="Borrando…"
        className="btn delete-account-form__confirm" disabled={typed !== id}
      />
    </Form>
  );
}
