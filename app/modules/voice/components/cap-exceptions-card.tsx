// Las excepciones del tope de la voz (spec «Registro abierto» de aios-tower, CA-33): las cuentas con su
// propio tope, el diálogo para quitar una y el formulario para poner o cambiar otra. Una excepción solo
// cambia el tope: nunca le da la voz a una cuenta Free, porque la voz va con el plan (CA-21).
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { VoiceCapException } from '../../../domain/voice-cap';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import type { VoiceAttempt } from '../voice-form-data';
import { CapExceptionForm } from './cap-exception-form';
import { CapExceptionsTable } from './cap-exceptions-table';
import { RemoveExceptionDialog } from './remove-exception-dialog';

type CapExceptionsCardProps = {
  exceptions: VoiceCapException[];
  generalUsd: number;
  maxUsd: number;
  onlySome: boolean;
  /** El último intento que no se hizo, de cualquiera de los formularios: cada uno toma solo el suyo. */
  attempt: VoiceAttempt | null;
};

export function CapExceptionsCard({ exceptions, generalUsd, maxUsd, onlySome, attempt }: CapExceptionsCardProps) {
  const location = useLocation();
  const failedRemoval = attempt?.intent === 'remove-exception' ? attempt : null;
  const [removing, setRemoving] = useState<string | null>(failedRemoval?.values.accountId ?? null);
  // Al volver de un cambio que salió bien (otra dirección) se cierra; si se rechazó, se reabre con el rechazo.
  useEffect(() => setRemoving(failedRemoval?.values.accountId ?? null), [location.key, failedRemoval]);
  // El «Quitar» de la fila: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLElement | null>(null);
  const chosen = exceptions.find((e) => e.accountId === removing) ?? null;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Excepciones por cuenta</h2>
        <p>Una cuenta con excepción usa su propio tope en lugar del general. No le da la voz a una cuenta Free: la voz va con el plan.</p></div></div>
      <div className="card-b">
        <FilterNotice onlySome={onlySome} />
        <CapExceptionsTable exceptions={exceptions} onRemove={(exception, button) => { trigger.current = button; setRemoving(exception.accountId); }} />
        <CapExceptionForm maxUsd={maxUsd} attempt={attempt?.intent === 'exception' ? attempt : null} />
      </div>
      {chosen && (
        <RemoveExceptionDialog
          key={chosen.accountId} exception={chosen} generalUsd={generalUsd}
          attempt={failedRemoval?.values.accountId === chosen.accountId ? failedRemoval : null}
          onClose={() => { setRemoving(null); trigger.current?.focus(); }}
        />
      )}
    </section>
  );
}
