// El tope general de la voz (spec «Registro abierto» de aios-tower, CA-33): cuánto rige hoy, quién lo
// fijó, y el formulario para cambiarlo. Cambiarlo pide un motivo, que queda en la auditoría con el antes
// y el después; el backend pide además MFA reciente, y su rechazo trae cómo volver a ingresar el código.
import { Form, useLocation } from 'react-router';
import type { GeneralVoiceCap } from '../../../domain/voice-cap';
import { FactList } from '../../../shared/ui/fact-list';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { formatDateTime } from '../../../shared/ui/format';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { INTENT_FIELD, REASON_MAX, type VoiceAttempt } from '../voice-form-data';
import { dollarsLabel } from '../voice-labels';
import './general-cap-card.css';

type GeneralCapCardProps = {
  general: GeneralVoiceCap;
  maxUsd: number;
  /** El último intento de este formulario que no se hizo, con lo escrito y por qué. */
  attempt: VoiceAttempt | null;
};

export function GeneralCapCard({ general, maxUsd, attempt }: GeneralCapCardProps) {
  // `key`: el formulario vuelve a nacer con cada dirección nueva, como la del aviso de un cambio que salió
  // bien; si no, el motivo de ese cambio seguiría escrito y viajaría a la auditoría del siguiente. Sin la
  // consulta en `action`: el aviso del cambio anterior (`?aviso=…`) no queda arriba de un rechazo nuevo.
  const { key, pathname } = useLocation();
  const setBy = general.isDefault
    ? 'Nadie: es el de por omisión'
    : <><span className="mono">{general.changedBy ?? '—'}</span>, el {formatDateTime(general.changedAt)}</>;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Tope general</h2>
        <p>Rige para cada persona de toda cuenta con la voz (Pro, empresas con plan, webinar y códigos) que no tenga una excepción.</p></div></div>
      <div className="card-b">
        <FactList facts={[
          { label: 'Tope', value: `${dollarsLabel(general.usd)} por persona al mes` },
          { label: 'Lo fijó', value: setBy },
          { label: 'Máximo', value: dollarsLabel(maxUsd) },
        ]} />
        <Form key={key} method="post" action={pathname} className="general-cap-form">
          {attempt?.rejection && <FormRejection rejection={attempt.rejection} />}
          <div className="grid g2">
            <div className="field">
              <label htmlFor="general-usd">Nuevo tope (US$ por persona al mes)</label>
              <input id="general-usd" name="usd" type="number" required min={0.01} max={maxUsd} step={0.01} defaultValue={attempt?.values.usd ?? general.usd} />
              <small>Mayor que 0 y hasta {dollarsLabel(maxUsd)}.</small>
              <FieldError message={attempt?.errors.usd} />
            </div>
            <div className="field">
              <label htmlFor="general-reason">Motivo</label>
              <input id="general-reason" name="reason" required maxLength={REASON_MAX} defaultValue={attempt?.values.reason ?? ''} placeholder="Ej: medido el primer mes" />
              <small>Queda en la auditoría, en Gobernanza, con el antes y el después.</small>
              <FieldError message={attempt?.errors.reason} />
            </div>
          </div>
          <div className="general-cap-form__actions">
            <SubmitButton name={INTENT_FIELD} value="general" label="Guardar el tope general" busyLabel="Guardando…" />
          </div>
        </Form>
      </div>
    </section>
  );
}
