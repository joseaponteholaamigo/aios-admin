// Confirmar la marca de superadministrador (spec «Equipo ENSŌ», CA-16): con ella, la persona puede
// todo, también dar de alta, suspender o retirar a cualquiera del equipo. No se marca de un clic.
import { useEffect, useId, useRef } from 'react';
import './superadmin-confirm-dialog.css';

export function SuperadminConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const titleId = useId();
  return (
    <dialog ref={ref} className="superadmin-confirm" aria-labelledby={titleId} onClose={onCancel}>
      <div className="superadmin-confirm__body">
        <h2 id={titleId} className="superadmin-confirm__title">¿Darle la marca de superadministrador?</h2>
        <p>Va a poder todo en el panel: todos los módulos, borrar cuentas y administrar al equipo, incluso suspenderte o retirarte a ti.</p>
        <div className="superadmin-confirm__buttons">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancelar</button>
          <button type="button" className="btn primary" onClick={onConfirm}>Sí, superadministrador</button>
        </div>
      </div>
    </dialog>
  );
}
