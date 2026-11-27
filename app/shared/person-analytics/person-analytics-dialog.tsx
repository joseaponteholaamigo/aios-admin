// El diálogo «Analítica y términos» de una persona (spec «Analítica de una persona», CA-11 a CA-13). Al abrir pide
// verla por detrás; dice si comparte su uso y la prueba de los términos y, a quien puede, ofrece cambiarla. Los dos
// pedidos van con fetchers a su ruta, con el correo en el cuerpo y nunca en la dirección: la pantalla no se mueve, lo
// guardado se muestra aquí y un rechazo se queda aquí. Lo abren las personas de una cuenta y la ficha de una cuenta
// personal.
import { useEffect, useId, useRef } from 'react';
import { useFetcher } from 'react-router';
import type { AnalyticsChangeOffer } from '../../domain/person-analytics';
import { AnalyticsChangeForm } from './analytics-change-form';
import { AnalyticsOverview } from './analytics-overview';
import { ANALYTICS_FIELDS, personAnalyticsHref, type AnalyticsAnswer } from './person-analytics-form-data';
import { ANALYTICS_INTRO, SEAT_REVOKED_NOTE, analyticsDialogTitle } from './person-analytics-labels';
import './person-analytics-dialog.css';

type PersonAnalyticsDialogProps = {
  email: string;
  companyId: string;
  /** Si se ofrece cambiarla (`analyticsChangeOffer`): solo con «editar» en Usuarios de clientes. */
  change: AnalyticsChangeOffer;
  onClose: () => void;
};

export function PersonAnalyticsDialog({ email, companyId, change, onClose }: PersonAnalyticsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const view = useFetcher<AnalyticsAnswer>();
  const save = useFetcher<AnalyticsAnswer>();
  const path = personAnalyticsHref(companyId);
  const titleId = useId();
  const introId = useId();
  // En una ref: si cambiara entre renders, el efecto volvería a pedirla en cada respuesta.
  const ask = useRef(view.submit);
  ask.current = view.submit;

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    void ask.current({ [ANALYTICS_FIELDS.action]: 'view', [ANALYTICS_FIELDS.email]: email }, { method: 'post', action: path });
  }, [email, path]);

  // ⛔ Mientras se guarda no se cierra: lo guardado o el rechazo que llegue quedaría sin su diálogo.
  const busy = save.state !== 'idle';
  const viewed = view.state === 'idle' ? view.data : undefined;
  // Lo último que dijo el backend: lo guardado, si ya se guardó (CA-13); si no, lo visto al abrir.
  const current = (save.data?.ok ? save.data.analytics : null) ?? (viewed?.ok ? viewed.analytics : null);
  return (
    <dialog
      ref={ref} className="person-analytics-dialog" aria-labelledby={titleId} aria-describedby={introId}
      onCancel={(e) => { if (busy) e.preventDefault(); }} onClose={onClose}
    >
      <div className="person-analytics-dialog__body">
        <h2 id={titleId} className="person-analytics-dialog__title">{analyticsDialogTitle(email)}</h2>
        <p id={introId} className="person-analytics-dialog__intro">{ANALYTICS_INTRO}</p>
        <AnalyticsOverview answer={viewed} current={current} />
        {current && change === 'seat-revoked' && <p className="person-analytics-dialog__note">{SEAT_REVOKED_NOTE}</p>}
        {current && change === 'offered' && <AnalyticsChangeForm save={save} path={path} email={email} sharing={current.sharing} />}
        <div className="person-analytics-dialog__buttons">
          <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.close()}>Cerrar</button>
        </div>
      </div>
    </dialog>
  );
}
