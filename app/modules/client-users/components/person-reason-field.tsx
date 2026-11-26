// El motivo, opcional, de una acción sobre una persona (spec «Editar cuentas y personas», CA-25 y CA-26).
// Queda en la auditoría del equipo; ante el cliente firma «el equipo de ENSŌ» (decisión 10).
import { useId } from 'react';
import { REASON_MAX, ACTION_FIELDS } from '../../../shared/person-actions/person-action-form-data';

export function PersonReasonField({ defaultValue }: { defaultValue: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Motivo (opcional)</label>
      <input id={id} name={ACTION_FIELDS.reason} maxLength={REASON_MAX} defaultValue={defaultValue} placeholder="Ej: lo pidió la admin por correo" />
      <small>Queda en la auditoría, en Gobernanza, con quién lo hizo.</small>
    </div>
  );
}
