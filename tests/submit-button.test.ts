// El botón que manda un formulario se bloquea mientras el pedido está en camino (regla «Front-end
// interaction» del CLAUDE.md global; CA-21 de la spec «Crear empresas e invitar personas»).
//
// EL DEFECTO QUE PREVIENE. Un botón que se puede oprimir dos veces manda dos pedidos: dos cuentas, o
// dos invitaciones. Y en un formulario con dos botones, si los dos dijeran «Moviendo…», la persona
// no sabría qué está pasando.
import { describe, expect, test } from 'vitest';
import { submitState } from '../app/shared/ui/submit-button';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

describe('el estado del botón', () => {
  test('sin nada en camino, disponible', () => {
    expect(submitState({ state: 'idle' })).toEqual({ busy: false, mine: false });
  });

  test('⛔ con un POST en camino se bloquea, también mientras carga la pantalla siguiente', () => {
    expect(submitState({ state: 'submitting', formMethod: 'POST', formData: form({}) })).toEqual({ busy: true, mine: true });
    expect(submitState({ state: 'loading', formMethod: 'POST', formData: form({}) }).busy).toBe(true);
  });

  test('cambiar de página con un enlace no lo bloquea', () => {
    expect(submitState({ state: 'loading' }).busy).toBe(false);
  });

  test('con dos botones, los dos se bloquean y solo el oprimido dice qué hace', () => {
    const conMover = { state: 'submitting', formMethod: 'post', formData: form({ move: '1' }) };
    expect(submitState(conMover, 'move', '1')).toEqual({ busy: true, mine: true });
    expect(submitState({ ...conMover, formData: form({}) }, 'move', '1')).toEqual({ busy: true, mine: false });
  });
});
