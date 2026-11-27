// «Revocar cuenta» o, en una cuenta revocada, «Reactivar cuenta» en su lugar, junto a «Borrar cuenta» (spec «Revocar
// y reactivar una cuenta», CA-11 y CA-12). Solo lo recibe el superadministrador. Desactivado, dice por qué en el aviso
// de la ficha (`STATUS_BLOCK_REASON_ID`); activo, abre su diálogo.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { AccountStatusOffer } from '../../../domain/account-status';
import { STATUS_ACTION_TEXTS } from '../account-status-labels';
import { AccountStatusDialog } from './account-status-dialog';

/** El id del aviso que dice por qué «Revocar cuenta» está desactivado. */
export const STATUS_BLOCK_REASON_ID = 'status-block-reason';

type CompanyStatusActionProps = { offer: AccountStatusOffer; companyId: string; companyTitle: string };

export function CompanyStatusAction({ offer, companyId, companyTitle }: CompanyStatusActionProps) {
  const [open, setOpen] = useState(false);
  // El botón que lo abrió: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  // Guardar vuelve a la ficha con el aviso (otra dirección): el diálogo se cierra con la ficha ya recargada.
  useEffect(() => setOpen(false), [location.key]);
  const label = STATUS_ACTION_TEXTS[offer.action].button;
  if (offer.blocked) return <button type="button" className="btn" disabled aria-describedby={STATUS_BLOCK_REASON_ID}>{label}</button>;
  return (
    <>
      <button ref={trigger} type="button" className="btn" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <AccountStatusDialog
          action={offer.action} companyId={companyId} companyTitle={companyTitle}
          onClose={() => { setOpen(false); trigger.current?.focus(); }}
        />
      )}
    </>
  );
}
