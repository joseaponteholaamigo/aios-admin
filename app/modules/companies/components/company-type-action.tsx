// «Pasar a cuenta personal» en una empresa, o «Pasar a empresa» en una cuenta personal (spec «Pasar una empresa a
// cuenta personal, y al revés», CA-11 y CA-12). Solo lo recibe el superadministrador. Abre su diálogo.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { AccountKind } from '../../../domain/companies';
import { TYPE_ACTION_TEXTS } from '../account-type-labels';
import { AccountTypeDialog } from './account-type-dialog';

/** `target`: el tipo al que pasa la cuenta (`accountTypeTarget`). */
type CompanyTypeActionProps = { target: AccountKind; companyId: string; companyTitle: string };

export function CompanyTypeAction({ target, companyId, companyTitle }: CompanyTypeActionProps) {
  const [open, setOpen] = useState(false);
  // El botón que lo abrió: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  // Guardar vuelve a la ficha con el aviso (otra dirección): el diálogo se cierra con la ficha ya recargada.
  useEffect(() => setOpen(false), [location.key]);
  return (
    <>
      <button ref={trigger} type="button" className="btn" onClick={() => setOpen(true)}>{TYPE_ACTION_TEXTS[target].button}</button>
      {open && (
        <AccountTypeDialog
          target={target} companyId={companyId} companyTitle={companyTitle}
          onClose={() => { setOpen(false); trigger.current?.focus(); }}
        />
      )}
    </>
  );
}
