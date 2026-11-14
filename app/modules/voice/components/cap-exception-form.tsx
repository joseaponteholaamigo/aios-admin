// Poner o cambiar la excepción del tope de la voz de una cuenta (spec «Registro abierto» de aios-tower,
// CA-33): la cuenta por su id, el tope y el motivo. Una cuenta que no existe, o que el filtro esconde,
// la rechaza el backend, y el rechazo va junto al campo de la cuenta.
import { Form, useLocation } from 'react-router';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { rejectionMessage } from '../../../shared/labels/write-rejection-labels';
import { ACCOUNT_ID_MAX, INTENT_FIELD, REASON_MAX, type VoiceAttempt } from '../voice-form-data';
import { dollarsLabel } from '../voice-labels';
import './cap-exception-form.css';

type CapExceptionFormProps = {
  maxUsd: number;
  /** El último intento de este formulario que no se hizo, con lo escrito y por qué. */
  attempt: VoiceAttempt | null;
};

export function CapExceptionForm({ maxUsd, attempt }: CapExceptionFormProps) {
  // `key` y `action` sin la consulta: lo mismo que en el tope general (`general-cap-card.tsx`).
  const { key, pathname } = useLocation();
  const rejection = attempt?.rejection ?? null;
  const accountRejected = rejection?.code === 'not-found';
  return (
    <Form key={key} method="post" action={pathname} className="cap-exception-form">
      <h3 className="eyebrow accent">Poner o cambiar una excepción</h3>
      {rejection && !accountRejected && <FormRejection rejection={rejection} />}
      <div className="grid g3">
        <div className="field">
          <label htmlFor="exception-account">Cuenta</label>
          <input id="exception-account" name="accountId" required maxLength={ACCOUNT_ID_MAX} defaultValue={attempt?.values.accountId ?? ''} placeholder="auteco-4d5e6f" autoCapitalize="none" spellCheck={false} />
          <small>Su id, como aparece en Empresas. Si ya tiene una excepción, la cambia.</small>
          <FieldError message={attempt?.errors.accountId ?? (rejection && accountRejected ? rejectionMessage(rejection) : null)} />
        </div>
        <div className="field">
          <label htmlFor="exception-usd">Tope (US$ por persona al mes)</label>
          <input id="exception-usd" name="usd" type="number" required min={0.01} max={maxUsd} step={0.01} defaultValue={attempt?.values.usd ?? ''} />
          <small>Mayor que 0 y hasta {dollarsLabel(maxUsd)}.</small>
          <FieldError message={attempt?.errors.usd} />
        </div>
        <div className="field">
          <label htmlFor="exception-reason">Motivo</label>
          <input id="exception-reason" name="reason" required maxLength={REASON_MAX} defaultValue={attempt?.values.reason ?? ''} placeholder="Queda en la auditoría" />
          <FieldError message={attempt?.errors.reason} />
        </div>
      </div>
      <div className="cap-exception-form__actions">
        <SubmitButton name={INTENT_FIELD} value="exception" label="Guardar la excepción" busyLabel="Guardando…" />
      </div>
    </Form>
  );
}
