// Qué diálogo de acción sobre una persona está abierto, y con qué rechazo. Lo comparten las personas de
// una cuenta y la ficha de una cuenta personal (spec «Editar cuentas y personas», CA-1): las dos abren el
// mismo diálogo y lo reabren igual cuando el backend rechaza.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { PersonAction, PersonActionTarget } from '../../domain/person-actions';
import type { PersonActionAttempt } from './person-action-form-data';

const sameTarget = (a: PersonActionTarget | null, b: PersonActionTarget | null) =>
  Boolean(a && b && a.action === b.action && a.email === b.email);

const targetOf = (attempt: PersonActionAttempt | null): PersonActionTarget | null =>
  attempt?.attempt ? { action: attempt.attempt.action, email: attempt.attempt.email } : null;

export function usePersonActionDialog(lastAttempt: PersonActionAttempt | null) {
  const location = useLocation();
  const [chosen, setChosen] = useState<PersonActionTarget | null>(targetOf(lastAttempt));
  // El botón que lo abrió: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLElement | null>(null);
  // Al volver de una acción que salió bien (otra dirección) se cierra; si la rechazó, se reabre con el rechazo.
  useEffect(() => setChosen(targetOf(lastAttempt)), [location.key, lastAttempt]);
  const sameAsChosen = lastAttempt !== null && sameTarget(targetOf(lastAttempt), chosen);
  return {
    chosen,
    /** El rechazo del último intento, solo si es de la acción y la persona del diálogo abierto. */
    rejection: sameAsChosen ? lastAttempt.rejection : null,
    /** Lo que mandó ese intento (el motivo escrito, el rol elegido), para volver a llenar el diálogo. */
    attempt: sameAsChosen ? lastAttempt.attempt : null,
    open(action: PersonAction, email: string, button: HTMLElement) {
      trigger.current = button;
      setChosen({ action, email });
    },
    close() {
      setChosen(null);
      trigger.current?.focus();
    },
  };
}
