// El menú de acciones de una persona en la tabla (CA-9). Es un `popover` nativo: se pinta en la capa
// de arriba del navegador, así que el `overflow` de la tabla no lo recorta (con una sola persona la
// tabla es más baja que la lista), y se cierra solo con un clic afuera o con Esc. Elegir una abre su diálogo.
// En una cuenta personal no se ofrece borrar a la persona, que es la única: se ofrece borrar la cuenta. Arriba de
// todo va «Analítica y términos», que pide solo «ver» (spec «Analítica de una persona», CA-10).
import { useId, useRef, type ToggleEvent } from 'react';
import { Link } from 'react-router';
import type { PersonAction } from '../../../domain/person-actions';
import { personActionMenuLabel } from '../../../shared/person-actions/person-action-labels';
import { ANALYTICS_MENU_LABEL } from '../../../shared/person-analytics/person-analytics-labels';
import './person-actions-menu.css';

/** Lo que mide la lista abierta con todas sus acciones, para abrirla hacia arriba si abajo no cabe. */
const LIST_HEIGHT_PX = 280;
const GAP_PX = 4;

type PersonActionsMenuProps = {
  actions: readonly PersonAction[];
  onChoose: (action: PersonAction, trigger: HTMLElement) => void;
  /** Con él, «Analítica y términos» abre el diálogo de la analítica de la persona. */
  onShowAnalytics?: (trigger: HTMLElement) => void;
  /** En una cuenta personal: a dónde lleva «Borrar cuenta», en lugar de «Borrar persona». */
  deleteAccountHref?: string;
};

export function PersonActionsMenu({ actions, onChoose, onShowAnalytics, deleteAccountHref }: PersonActionsMenuProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Al abrir, la lista se pone a la IZQUIERDA de su botón, a la altura de su fila: debajo taparía el
  // «Acciones» de la fila siguiente, y un clic ahí elegiría una acción de esta persona. Si abajo no
  // cabe, sube. Si la página se desplaza, se cierra: en la capa de arriba no acompaña al botón.
  function place(e: ToggleEvent<HTMLDivElement>) {
    const box = trigger.current?.getBoundingClientRect();
    if (e.newState !== 'open' || !box || !list.current) return;
    const fits = box.top + LIST_HEIGHT_PX <= window.innerHeight;
    Object.assign(list.current.style, {
      right: `${window.innerWidth - box.left + GAP_PX}px`,
      top: fits ? `${box.top}px` : 'auto',
      bottom: fits ? 'auto' : `${window.innerHeight - box.bottom}px`,
    });
    window.addEventListener('scroll', () => list.current?.hidePopover(), { once: true, capture: true });
  }

  return (
    <>
      <button ref={trigger} type="button" className="btn sm ghost" popoverTarget={id}>Acciones</button>
      <div ref={list} id={id} popover="auto" className="person-actions-menu" onBeforeToggle={place}>
        {onShowAnalytics && (
          <button type="button" className="person-actions-menu__item" onClick={() => {
            list.current?.hidePopover();
            if (trigger.current) onShowAnalytics(trigger.current);
          }}>
            {ANALYTICS_MENU_LABEL}
          </button>
        )}
        {actions.map((action) => (
          <button key={action} type="button" className="person-actions-menu__item" onClick={() => {
            list.current?.hidePopover();
            if (trigger.current) onChoose(action, trigger.current);
          }}>
            {personActionMenuLabel[action]}
          </button>
        ))}
        {deleteAccountHref && <Link to={deleteAccountHref} className="person-actions-menu__item">Borrar cuenta (es personal: su única persona)</Link>}
      </div>
    </>
  );
}
