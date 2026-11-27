// El estado de la clave de la casa de un servicio (spec «Compartir referentes» de aios-tower, D16 y D21): si
// está puesta y en qué termina, quién la cambió y cuándo, el saldo de la casa y el interruptor, que se mueve
// con un motivo. El formulario manda el estado que se quiere, no «cambiar»: si otro superadmin lo movió
// mientras tanto, repetirlo deja lo mismo.
import { Form, useLocation } from 'react-router';
import type { HouseKeyStatus } from '../../../domain/house-keys';
import { badgeClass } from '../../../shared/ui/badge';
import { FactList, type Fact } from '../../../shared/ui/fact-list';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { FIELDS, INTENT_FIELD, REASON_MAX, type HouseKeyAttempt } from '../house-key-form-data';
import { SERVICE_INFO, balanceLabel, enabledLabel, keyStateLabel, lastChangeLabel } from '../house-keys-labels';
import './key-status-card.css';

type KeyStatusCardProps = {
  status: HouseKeyStatus;
  /** El último intento de mover el interruptor que no se hizo, con lo escrito y por qué. */
  attempt: HouseKeyAttempt | null;
};

export function KeyStatusCard({ status, attempt }: KeyStatusCardProps) {
  // `key`: el formulario vuelve a nacer con cada dirección nueva (la del aviso de un cambio que salió bien); si
  // no, el motivo de ese cambio seguiría escrito. Sin la consulta en `action`: el aviso anterior no queda arriba.
  const { key, pathname } = useLocation();
  const { name, uses } = SERVICE_INFO[status.service];
  const keyState = keyStateLabel(status);
  const enabled = enabledLabel(status.enabled);
  const facts: Fact[] = [
    { label: 'Clave', value: <span className={badgeClass(keyState.tone)}>{keyState.text}</span> },
    { label: 'Último cambio', value: lastChangeLabel(status.lastChange) },
    ...(status.lastChange.reason ? [{ label: 'Motivo', value: status.lastChange.reason }] : []),
    { label: 'Saldo de la casa', value: status.balance === null ? balanceLabel(null) : `${balanceLabel(status.balance)} de ${name}` },
    { label: 'Para todos', value: <span className={badgeClass(enabled.tone)}>{enabled.text}</span> },
  ];
  const turningOff = status.enabled;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Estado</h2>
        <p>La clave nunca se muestra entera: solo sus últimos 4 caracteres, para saber cuál está puesta.</p></div></div>
      <div className="card-b key-status">
        <FactList facts={facts} />
        <Form key={key} method="post" action={pathname} className="key-status__switch">
          {attempt?.rejection && <FormRejection rejection={attempt.rejection} />}
          <input type="hidden" name={FIELDS.enabled} value={String(!status.enabled)} />
          <div className="field">
            <label htmlFor="switch-reason">{turningOff ? 'Motivo para apagarlo' : 'Motivo para encenderlo'}</label>
            <input
              id="switch-reason" name={FIELDS.reason} required maxLength={REASON_MAX} defaultValue={attempt?.values.reason ?? ''}
              placeholder={turningOff ? 'Ej: gasto raro, revisar' : 'Ej: revisado, era una prueba'}
            />
            <small>
              {turningOff
                ? `Apaga ${uses} para todas las cuentas hasta que alguien lo encienda.`
                : `Vuelve a ofrecer ${uses} a las cuentas con plan.${status.keySet ? '' : ' Sin clave no funciona: pon una también.'}`}
            </small>
            <FieldError message={attempt?.errors.reason ?? attempt?.errors.enabled} />
          </div>
          <div className="key-status__actions">
            <SubmitButton
              name={INTENT_FIELD} value="switch" className={turningOff ? 'btn' : 'btn primary'}
              label={turningOff ? `Apagar ${name}` : `Encender ${name}`} busyLabel={turningOff ? 'Apagando…' : 'Encendiendo…'}
            />
          </div>
        </Form>
      </div>
    </section>
  );
}
