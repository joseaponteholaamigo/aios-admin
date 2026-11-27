// «Quitar la pausa», o el «Descongelar» de un lote, en la tarjeta «Servicios de ENSŌ en revisión» (spec «Reanudar la
// casa de una cuenta», CA-11 a CA-13). Solo lo recibe el superadministrador. Abre su diálogo: nada cambia hasta que se
// confirma ahí.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { HouseReview, HouseTarget } from '../../../domain/house';
import { HOUSE_ACTION_TEXTS, houseActionLabel } from '../house-labels';
import { HouseChangeDialog } from './house-change-dialog';

type HouseChangeActionProps = { target: HouseTarget; house: HouseReview; companyId: string; companyTitle: string };

export function HouseChangeAction({ target, house, companyId, companyTitle }: HouseChangeActionProps) {
  const [open, setOpen] = useState(false);
  // El botón que lo abrió: al cerrar el diálogo el foco vuelve ahí, y no al principio de la página.
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  // Guardar vuelve a la ficha con el aviso (otra dirección): el diálogo se cierra con la ficha ya recargada.
  useEffect(() => setOpen(false), [location.key]);
  return (
    <>
      <button
        ref={trigger} type="button" className={target.action === 'unfreeze' ? 'btn sm' : 'btn'}
        aria-label={houseActionLabel(target)} onClick={() => setOpen(true)}
      >
        {HOUSE_ACTION_TEXTS[target.action].button}
      </button>
      {open && (
        <HouseChangeDialog
          target={target} house={house} companyId={companyId} companyTitle={companyTitle}
          onClose={() => { setOpen(false); trigger.current?.focus(); }}
        />
      )}
    </>
  );
}
