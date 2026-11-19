// La fila de Empresas, Cuentas personales y Usuarios de clientes se abre con un clic en cualquier parte.
//
// EL DEFECTO QUE PREVIENE. Si la fila se abriera también al soltar el mouse después de arrastrar
// sobre un correo, soporte perdería la lista cada vez que copia uno. Si se abriera al pulsar su
// enlace, navegaría dos veces y «Atrás» volvería a la misma ficha. Y si se abriera con Ctrl o Cmd,
// quien quería la ficha en otra pestaña perdería la lista en esta.
import { describe, expect, test } from 'vitest';
import { opensRow, type ClickEvent } from '../app/shared/ui/row-click';

/** Un elemento de la fila que sabe responder `closest` como el navegador: solo con su etiqueta. */
const onElement = (tag: string): ClickEvent['target'] => ({
  closest: (selector) => (selector.split(',').map((s) => s.trim()).includes(tag) ? {} : null),
});
const click = (tag: string, keys: Partial<ClickEvent> = {}): ClickEvent => ({
  metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: onElement(tag), ...keys,
});

describe('qué clic abre la fila', () => {
  test('un clic simple en una celda o en un texto de la fila la abre', () => {
    expect([opensRow(click('td'), ''), opensRow(click('span'), '')]).toEqual([true, true]);
  });

  test('⛔ soltar el mouse después de elegir texto no la abre: se estaba copiando', () => {
    expect(opensRow(click('td'), 'ana@acme.com')).toBe(false);
  });

  test('⛔ un clic sobre el enlace de la fila lo atiende el enlace: la fila no navega otra vez', () => {
    expect(opensRow(click('a'), '')).toBe(false);
  });

  test('un clic sobre un botón de la fila lo atiende el botón', () => {
    expect(opensRow(click('button'), '')).toBe(false);
  });

  test('con Ctrl o Cmd la fila no navega en esta pestaña', () => {
    expect([opensRow(click('td', { ctrlKey: true }), ''), opensRow(click('td', { metaKey: true }), '')]).toEqual([false, false]);
  });
});
