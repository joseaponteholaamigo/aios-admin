// Poner, cambiar o quitar la clave de la casa de un servicio (spec «Compartir referentes» de aios-tower, D17,
// D20 y D21; CA-30, CA-31, CA-39 y CA-40). Con una clave puesta es «Cambiar la clave»; sin ella, «Poner una
// clave». El backend la prueba con el proveedor antes de guardarla: si la rechaza, no cambia nada. Con el
// proveedor apagado aparece «Encender … al guardar», marcada solo cuando no había clave.
//
// ⚠️ LA CLAVE NUNCA SE VUELVE A PINTAR (CA-31). El campo es de contraseña, sin «mostrar» y sin autocompletar,
// no tiene `defaultValue`, y lo que devuelve la acción no la trae. Después de un envío rechazado el campo se
// vacía (el efecto de abajo), y uno que salió bien cambia de dirección y el formulario vuelve a nacer.
import { useEffect, useRef, useState } from 'react';
import { Form, useLocation } from 'react-router';
import type { HouseKeyStatus } from '../../../domain/house-keys';
import { FieldError } from '../../../shared/ui/field-error';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { FIELDS, INTENT_FIELD, KEY_MAX, REASON_MAX, type HouseKeyAttempt } from '../house-key-form-data';
import { SERVICE_INFO, keyRejectionMessage } from '../house-keys-labels';
import { RemoveKeyDialog } from './remove-key-dialog';
import './key-form-card.css';

type KeyFormCardProps = {
  status: HouseKeyStatus;
  /** El último intento de poner o cambiar la clave que no se hizo: lo escrito (sin la clave) y por qué. */
  keyAttempt: HouseKeyAttempt | null;
  /** El último intento de quitarla que no se hizo: reabre la confirmación con el rechazo. */
  removeAttempt: HouseKeyAttempt | null;
};

/**
 * Lo que necesita el campo de la clave para que nadie la vea ni la guarde: tipo contraseña, sin autocompletar ni
 * corrector, y fuera de los gestores de contraseñas más usados (cada uno lee su propia marca).
 */
const SECRET_INPUT = {
  type: 'password', autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'none', spellCheck: false,
  'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other',
} as const;

export function KeyFormCard({ status, keyAttempt, removeAttempt }: KeyFormCardProps) {
  const { key, pathname } = useLocation();
  const { name } = SERVICE_INFO[status.service];
  const keyInput = useRef<HTMLInputElement>(null);
  // Cada respuesta de la acción es un intento nuevo: lo que quedó en el campo de la clave se borra.
  useEffect(() => {
    if (keyInput.current) keyInput.current.value = '';
  }, [keyAttempt]);
  const [removing, setRemoving] = useState(removeAttempt !== null);
  // Al volver de un cambio que salió bien (otra dirección) se cierra; si se rechazó, se reabre con el rechazo.
  useEffect(() => setRemoving(removeAttempt !== null), [key, removeAttempt]);
  const removeButton = useRef<HTMLButtonElement>(null);
  const rejection = keyAttempt?.rejection ?? null;
  const title = status.keySet ? 'Cambiar la clave' : 'Poner una clave';
  return (
    <section className="card">
      <div className="card-h"><div><h2>{title}</h2>
        <p>Pega la clave nueva del panel de {name}. Se prueba antes de guardarla.</p></div></div>
      <div className="card-b key-form-card">
        <Form key={key} method="post" action={pathname} className="key-form" autoComplete="off">
          {rejection && <FormRejection rejection={rejection} message={keyRejectionMessage(rejection, status.service)} />}
          <div className="field">
            <label htmlFor="house-key-value">Clave nueva</label>
            <input ref={keyInput} id="house-key-value" name={FIELDS.key} required maxLength={KEY_MAX} placeholder="Pega la clave nueva" {...SECRET_INPUT} />
            <small>
              {status.keySet
                ? 'La clave actual no se muestra: se reemplaza. La nueva tampoco se vuelve a mostrar después de guardarla.'
                : 'No se vuelve a mostrar después de guardarla: solo sus últimos 4 caracteres.'}
            </small>
            <FieldError message={keyAttempt?.errors.key} />
          </div>
          <div className="field">
            <label htmlFor="house-key-reason">Motivo</label>
            <input id="house-key-reason" name={FIELDS.reason} required maxLength={REASON_MAX} defaultValue={keyAttempt?.values.reason ?? ''} placeholder="Ej: rotación trimestral" />
            <small>Queda en la auditoría, en Gobernanza. La clave no.</small>
            <FieldError message={keyAttempt?.errors.reason} />
          </div>
          {!status.enabled && (
            <label className="key-form__check">
              <input type="checkbox" name={FIELDS.enable} defaultChecked={keyAttempt ? keyAttempt.values.enable === 'on' : !status.keySet} /> Encender {name} al guardar
            </label>
          )}
          <div className="key-form__actions">
            <SubmitButton name={INTENT_FIELD} value="key" label="Probar y guardar la clave" busyLabel="Probando la clave…" />
          </div>
        </Form>
        {status.keySet && (
          <div className="key-form-card__remove">
            <h3 className="eyebrow">Quitar la clave</h3>
            <p className="small muted">
              Vacía la clave y apaga {name} para todos al instante. Pide confirmación y un motivo. Para anularla del todo, revócala también en el panel de {name}.
            </p>
            <div className="key-form__actions">
              <button ref={removeButton} type="button" className="btn key-form-card__remove-open" onClick={() => setRemoving(true)}>Quitar la clave</button>
            </div>
          </div>
        )}
      </div>
      {removing && status.keySet && (
        <RemoveKeyDialog
          service={status.service} attempt={removeAttempt}
          onClose={() => { setRemoving(false); removeButton.current?.focus(); }}
        />
      )}
    </section>
  );
}
