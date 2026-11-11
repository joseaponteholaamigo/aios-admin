// El formulario de «Nuevo código» (spec «Códigos de registro», CA-1 a CA-3 y CA-7). Lo escrito vuelve
// si el backend lo rechaza, con el error junto a su campo, y la clave es la misma en cada reintento:
// crear dos veces es crear uno. Las fechas se escriben en hora de Bogotá.
import { useState } from 'react';
import { Form, Link } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import type { DurationKind } from '../../../domain/codes';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { rejectionMessage } from '../../../shared/labels/write-rejection-labels';
import { thousands } from '../code-labels';
import { CODE_MAX, CODE_MIN, DEFAULT_DAILY_BRAKE, DEFAULT_MONTHLY_CREDITS, LABEL_MAX, MONTHLY_CREDITS_MAX, REASON_MAX, USES_MAX, durationMax } from '../code-limits';
import type { FormValues } from '../new-code-form-data';
import './new-code-form.css';

type Props = { formKey: string; values: FormValues | null; errors: Record<string, string>; rejection: WriteRejection | null };

/** Los campos que muestran su error. Un rechazo que nombra otro (o ninguno) va arriba del formulario. */
const PLACED_FIELDS = new Set(['code', 'label', 'from', 'until', 'duration', 'durationN', 'durationDate', 'monthlyCredits', 'cap', 'dailyBrake', 'reason', 'key']);

/** El campo que señala un rechazo del backend, si es uno que el formulario muestra. */
function fieldOf(rejection: WriteRejection | null): string | null {
  const field = rejection?.code === 'invalid' ? rejection.field ?? null : rejection?.code === 'code-exists' ? 'code' : null;
  return field && PLACED_FIELDS.has(field) ? field : null;
}

export function NewCodeForm({ formKey, values, errors, rejection }: Props) {
  const [kind, setKind] = useState<DurationKind>((values?.durationKind as DurationKind | undefined) ?? 'months');
  const field = fieldOf(rejection);
  const errorOf = (name: string) => errors[name] ?? (rejection && field === name ? rejectionMessage(rejection) : null);
  const value = (name: string, fallback = '') => values?.[name] ?? fallback;
  return (
    <Form method="post" className="new-code">
      <input type="hidden" name="key" value={formKey} />
      {rejection && !field && <FormRejection rejection={rejection} />}
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 1</span><h2>El código</h2>
          <p>Vacío, se genera uno al azar (ENSO-XXXX-XXXX-XXXX). Escrito a mano se puede adivinar: lleva siempre tope.</p></div></div>
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="code">Código (opcional)</label>
            <input id="code" name="code" minLength={CODE_MIN} maxLength={CODE_MAX} defaultValue={value('code')} placeholder="WEBINAR-NOV" autoCapitalize="characters" spellCheck={false} />
            <FieldError message={errorOf('code')} />
          </div>
          <div className="field">
            <label htmlFor="label">Etiqueta</label>
            <input id="label" name="label" required maxLength={LABEL_MAX} defaultValue={value('label')} placeholder="Webinar de noviembre" />
            <small>Solo para el equipo: la persona no la ve.</small>
            <FieldError message={errorOf('label')} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 2</span><h2>Cuándo sirve</h2><p>En hora de Bogotá. Todo código vence: ninguno es infinito.</p></div></div>
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="from">Válido desde (opcional)</label>
            <input id="from" name="from" type="datetime-local" defaultValue={value('from')} />
            <small>Vacío: desde ahora.</small>
            <FieldError message={errorOf('from')} />
          </div>
          <div className="field">
            <label htmlFor="until">Válido hasta</label>
            <input id="until" name="until" type="datetime-local" required defaultValue={value('until')} />
            <FieldError message={errorOf('until')} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 3</span><h2>Lo que da</h2><p>Pro en una cuenta personal, para cada persona que lo use.</p></div></div>
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="durationKind">Cuánto dura el Pro</label>
            <select id="durationKind" name="durationKind" value={kind} onChange={(e) => setKind(e.target.value as DurationKind)}>
              <option value="months">Meses desde el canje</option>
              <option value="days">Días desde el canje</option>
              <option value="until">Hasta una fecha</option>
              <option value="no-end">Sin fin</option>
            </select>
            <FieldError message={errorOf('duration')} />
          </div>
          {(kind === 'months' || kind === 'days') && (
            <div className="field">
              <label htmlFor="durationN">{kind === 'months' ? 'Meses' : 'Días'}</label>
              <input id="durationN" name="durationN" type="number" min={1} max={durationMax(kind)} required defaultValue={value('durationN', kind === 'months' ? '2' : '30')} />
              <FieldError message={errorOf('durationN')} />
            </div>
          )}
          {kind === 'until' && (
            <div className="field">
              <label htmlFor="durationDate">El último día del plan</label>
              <input id="durationDate" name="durationDate" type="date" required defaultValue={value('durationDate')} />
              <FieldError message={errorOf('durationDate')} />
            </div>
          )}
          <div className="field">
            <label htmlFor="monthlyCredits">Créditos al mes</label>
            <input id="monthlyCredits" name="monthlyCredits" type="number" min={0} max={MONTHLY_CREDITS_MAX} required defaultValue={value('monthlyCredits', String(DEFAULT_MONTHLY_CREDITS))} />
            <small>De 0 a {thousands(MONTHLY_CREDITS_MAX)}. Cada crédito se paga: un código para una promoción abierta puede dar menos.</small>
            <FieldError message={errorOf('monthlyCredits')} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><div><span className="eyebrow accent">Paso 4</span><h2>Los límites</h2><p>Cada reserva hace que llegue un correo: el tope y el freno acotan cuántos salen.</p></div></div>
        <div className="card-b grid g2">
          <div className="field">
            <label htmlFor="cap">Tope de usos</label>
            <input id="cap" name="cap" type="number" min={1} max={USES_MAX} defaultValue={value('cap')} placeholder="Sin tope" />
            <small>Vacío: sin tope (solo un código generado).</small>
            <FieldError message={errorOf('cap')} />
          </div>
          <div className="field">
            <label htmlFor="dailyBrake">Freno del día</label>
            <input id="dailyBrake" name="dailyBrake" type="number" min={1} max={USES_MAX} required defaultValue={value('dailyBrake', String(DEFAULT_DAILY_BRAKE))} />
            <small>Más reservas que esto en un día pausan el código y suena la alarma.</small>
            <FieldError message={errorOf('dailyBrake')} />
          </div>
          <div className="field new-code__wide">
            <label htmlFor="reason">Motivo (opcional)</label>
            <input id="reason" name="reason" maxLength={REASON_MAX} defaultValue={value('reason')} placeholder="Para la auditoría del equipo" />
            <FieldError message={errorOf('reason')} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-b">
          <FieldError message={errorOf('key')} />
          <div className="new-code__actions">
            <SubmitButton label="Crear código" busyLabel="Creando…" />
            <Link className="btn ghost" to="/codes">Cancelar</Link>
          </div>
        </div>
      </section>
    </Form>
  );
}
