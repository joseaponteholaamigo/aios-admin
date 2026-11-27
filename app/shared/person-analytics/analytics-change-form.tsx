// «Dejar de compartir» o «Volver a compartir», con un motivo opcional (spec «Analítica de una persona», CA-12 y CA-13).
// Ofrece lo contrario de lo que hay. Al dejar de compartir recuerda que lo ya enviado no se borra, y cómo se borra en el
// proveedor de analítica. Va por el fetcher del diálogo: lo guardado lo muestra el diálogo sin recargar la página, y un
// rechazo se queda aquí con el botón disponible otra vez.
import { useEffect, useId, useRef } from 'react';
import type { FetcherWithComponents } from 'react-router';
import { changeFor, type AnalyticsSharing } from '../../domain/person-analytics';
import { DoneNotice } from '../ui/done-notice';
import { FieldError } from '../ui/field-error';
import { FormRejection } from '../ui/form-rejection';
import { SubmitButton } from '../ui/submit-button';
import { ANALYTICS_FIELDS, REASON_MAX, type AnalyticsAnswer } from './person-analytics-form-data';
import {
  ANALYTICS_CHANGE_TEXTS, REASON_HINT, WITHDRAW_REMINDER, analyticsDoneText, analyticsRejectionMessage,
} from './person-analytics-labels';
import './analytics-change-form.css';

type AnalyticsChangeFormProps = {
  /** El pedido de guardar: lo crea el diálogo, que muestra el estado nuevo con su respuesta. */
  save: FetcherWithComponents<AnalyticsAnswer>;
  /** La ruta del diálogo (`personAnalyticsHref`). */
  path: string;
  email: string;
  /** Lo que hay hoy: se ofrece lo contrario. */
  sharing: AnalyticsSharing;
};

export function AnalyticsChangeForm({ save, path, email, sharing }: AnalyticsChangeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const reasonId = useId();
  const change = changeFor(sharing);
  const t = ANALYTICS_CHANGE_TEXTS[change];
  const answer = save.state === 'idle' ? save.data : undefined;
  const saved = answer?.ok ? answer.analytics : null;
  const failed = answer && !answer.ok ? answer : null;
  // Guardado: el motivo queda limpio para el cambio siguiente.
  useEffect(() => {
    if (saved) formRef.current?.reset();
  }, [saved]);
  return (
    <save.Form ref={formRef} method="post" action={path} className="analytics-change-form">
      <h3 className="eyebrow accent">Cambiar su analítica</h3>
      {saved && <DoneNotice text={analyticsDoneText(saved)} />}
      {saved?.sharing === 'withdrawn' && <p className="analytics-change-form__reminder">{WITHDRAW_REMINDER}</p>}
      <p>{t.explanation}</p>
      {change === 'withdraw' && <p className="analytics-change-form__reminder">{WITHDRAW_REMINDER}</p>}
      {failed?.rejection && <FormRejection rejection={failed.rejection} message={analyticsRejectionMessage(failed.rejection, 'change')} />}
      <input type="hidden" name={ANALYTICS_FIELDS.action} value={change} />
      <input type="hidden" name={ANALYTICS_FIELDS.email} value={email} />
      <div className="field">
        <label htmlFor={reasonId}>Motivo (opcional)</label>
        <textarea
          id={reasonId} name={ANALYTICS_FIELDS.reason} maxLength={REASON_MAX} className="analytics-change-form__reason"
          placeholder="Ej: lo pidió por correo el 27 de noviembre"
        />
        <small>{REASON_HINT}</small>
        <FieldError message={failed?.errors.reason} />
      </div>
      <div className="analytics-change-form__buttons">
        <SubmitButton label={t.button} busyLabel={t.busy} pending={save} />
      </div>
    </save.Form>
  );
}
