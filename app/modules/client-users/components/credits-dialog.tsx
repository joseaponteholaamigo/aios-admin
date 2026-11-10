// El diálogo de «Créditos» de una persona (spec «Créditos por persona» de aios-tower, CA-21 a CA-23):
// su saldo —la bolsa del mes, sus lotes y sus últimos movimientos— y, para quien puede, el formulario
// para cargarle créditos. Los dos van por detrás con un fetcher: el correo viaja en el cuerpo y
// nunca en la dirección, y la lista de personas no se mueve.
import { useEffect, useId, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import type { PersonCredits } from '../../../domain/credits';
import { LOAD_MAX } from '../../../domain/credits';
import { accessLabel, formatCredits } from '../../../shared/labels/credit-labels';
import { badgeClass } from '../../../shared/ui/badge';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { formatDate, formatDateTime } from '../../../shared/ui/format';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { REASON_MAX } from '../credit-load-form-data';
import type { PersonCreditsAnswer } from '../routes/person-credits';
import type { CreditLoadAnswer } from '../routes/person-credits-load';
import { CreditMovements } from './credit-movements';
import './credits-dialog.css';

type CreditsDialogProps = {
  email: string;
  companyId: string;
  canSee: boolean;
  canLoad: boolean;
  onClose: () => void;
};

/** Una clave nueva por formulario abierto: enviarlo dos veces (doble clic, reintento) carga una sola vez (CA-22). */
const newKey = () => `carga-${crypto.randomUUID()}`;

const REASONS = { 'not-found': 'Esa persona ya no está en esta cuenta.', forbidden: 'No tienes permiso para ver créditos.', invalid: 'El pedido no se entendió.', unavailable: 'La API no respondió: cierra y vuelve a abrir.' } as const;

export function CreditsDialog({ email, companyId, canSee, canLoad, onClose }: CreditsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const balance = useFetcher<PersonCreditsAnswer>();
  const load = useFetcher<CreditLoadAnswer>();
  const [key, setKey] = useState(newKey);
  const titleId = useId();
  const base = `/client-users/${encodeURIComponent(companyId)}/credits`;
  // En una ref: si cambiara entre renders, el efecto volvería a pedir el saldo en cada respuesta.
  const ask = useRef(balance.submit);
  ask.current = balance.submit;

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    if (canSee) void ask.current({ email }, { method: 'post', action: base });
  }, [canSee, email, base]);

  // Una carga que salió bien: el formulario queda limpio y con una clave nueva, y el saldo se vuelve a pedir.
  const loaded = load.data?.ok ? load.data.loaded : null;
  useEffect(() => {
    if (!loaded) return;
    formRef.current?.reset();
    setKey(newKey());
    if (canSee) void ask.current({ email }, { method: 'post', action: base });
  }, [loaded, canSee, email, base]);

  const busy = load.state !== 'idle';
  const failed = load.data && !load.data.ok ? load.data : null;
  return (
    <dialog ref={ref} className="credits-dialog" aria-labelledby={titleId} onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}>
      <div className="credits-dialog__body">
        <h2 id={titleId} className="credits-dialog__title">Créditos de {email}</h2>
        {canSee && <Balance answer={balance.data?.email === email ? balance.data : undefined} />}
        {canLoad && (
          <load.Form ref={formRef} method="post" action={`${base}/load`} className="credits-dialog__load">
            <h3 className="eyebrow accent">Cargar créditos</h3>
            <p className="credits-dialog__hint">Un lote que vence a un mes. La empresa lo paga por factura, por fuera de Stripe.</p>
            {loaded && <p className="credits-dialog__done" role="status">Se cargaron {formatCredits(loaded.credits)} créditos: vencen el {formatDateTime(loaded.expiresAt)}.</p>}
            {failed?.rejection && <FormRejection rejection={failed.rejection} />}
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="key" value={key} />
            <div className="credits-dialog__fields">
              <div className="field">
                <label htmlFor="credits">Créditos</label>
                <input id="credits" name="credits" type="number" required min={1} max={LOAD_MAX} step={1} placeholder="11000" />
                <FieldError message={failed?.errors.credits ?? failed?.errors.email ?? failed?.errors.key} />
              </div>
              <div className="field">
                <label htmlFor="reason">Motivo</label>
                <input id="reason" name="reason" required maxLength={REASON_MAX} placeholder="Ej: factura 1234" />
                <FieldError message={failed?.errors.reason} />
              </div>
            </div>
            <div className="credits-dialog__buttons">
              <SubmitButton label="Cargar" busyLabel="Cargando…" pending={load} />
            </div>
          </load.Form>
        )}
        <div className="credits-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cerrar</button>
        </div>
      </div>
    </dialog>
  );
}

function Balance({ answer }: { answer: PersonCreditsAnswer | undefined }) {
  if (!answer) return <p className="credits-dialog__hint" aria-busy="true">Leyendo el saldo…</p>;
  if (!answer.ok) return <p className="credits-dialog__hint" role="alert">{REASONS[answer.reason]}</p>;
  const c: PersonCredits = answer.credits;
  const access = accessLabel(c.access);
  return (
    <section className="credits-dialog__balance">
      <p>
        <span className={badgeClass(access.tone)}>{access.text}</span>{' '}
        <strong className="mono">{formatCredits(c.available)}</strong> disponibles
        {c.reserved > 0 && <> · <span className="mono">{formatCredits(c.reserved)}</span> en curso</>}
      </p>
      <p className="credits-dialog__hint">
        Bolsa del mes: <span className="mono">{formatCredits(c.month.balance)}</span> de {formatCredits(c.month.credits)}, se renueva el {formatDateTime(c.month.renewsAt)}.
      </p>
      {c.lots.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Lote</th><th>Saldo</th><th>Vence</th></tr></thead>
            <tbody>
              {c.lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="small">{lot.name ?? (lot.origin === 'purchase' ? 'Paquete' : 'Carga')}</td>
                  <td className="small mono">{formatCredits(lot.balance)} de {formatCredits(lot.credits)}</td>
                  <td className="small">{formatDate(lot.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreditMovements movements={c.movements} />
    </section>
  );
}
