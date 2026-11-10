// El menú de acciones de una persona en la tabla (CA-9). Es un `popover` nativo: se pinta en la capa
// de arriba del navegador, así que el `overflow` de la tabla no lo recorta (con una sola persona la
// tabla es más baja que la lista), y se cierra solo con un clic afuera o con Esc. Elegir una abre su diálogo.
import { useId, useRef, type ToggleEvent } from 'react';
import { PERSON_ACTIONS, type PersonAction } from '../../../domain/person-actions';
import { personActionMenuLabel } from '../person-action-labels';
import './person-actions-menu.css';

/** Lo que mide la lista abierta, para abrirla hacia arriba si abajo no cabe. */
const LIST_HEIGHT_PX = 150;
const GAP_PX = 4;

export function PersonActionsMenu({ onChoose }: { onChoose: (action: PersonAction, trigger: HTMLElement) => void }) {
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
        {PERSON_ACTIONS.map((action) => (
          <button key={action} type="button" className="person-actions-menu__item" onClick={() => {
            list.current?.hidePopover();
            if (trigger.current) onChoose(action, trigger.current);
          }}>
            {personActionMenuLabel[action]}
          </button>
        ))}
      </div>
    </>
  );
}
