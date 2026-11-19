// El tema claro, el oscuro o el del sistema, sin destello al cargar (CA-25).
//
// EL DEFECTO QUE PREVIENE. Si el script del <head> no fijara el tema guardado, quien eligió oscuro
// vería cada carga empezar en claro. Si lanzara al no poder leer `localStorage` (Safari en
// privado), cortaría el resto de los scripts de la página. Y si el botón calculara mal el tema que
// se ve, el primer clic no cambiaría nada.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, toggledTheme } from '../app/shared/layout/theme';
import { ThemeScript } from '../app/shared/layout/theme-script';
import { CspNonceContext } from '../app/shared/layout/csp-nonce-context';

/** Corre el script del <head> de verdad, con un `localStorage` y un `document` de mentira. */
function runInitScript(storage: { getItem: (key: string) => string | null }) {
  const documentElement = { dataset: {} as Record<string, string> };
  new Function('localStorage', 'document', THEME_INIT_SCRIPT)(storage, { documentElement });
  return documentElement.dataset.theme;
}

const storageWith = (value: string | null) => ({ getItem: (key: string) => (key === THEME_STORAGE_KEY ? value : null) });

describe('el script del tema, antes de pintar', () => {
  test('fija el tema guardado', () => {
    expect(runInitScript(storageWith('dark'))).toBe('dark');
    expect(runInitScript(storageWith('light'))).toBe('light');
  });

  test('sin preferencia, o con una que no es un tema, no fija nada: manda el sistema', () => {
    expect(runInitScript(storageWith(null))).toBeUndefined();
    expect(runInitScript(storageWith('<script>'))).toBeUndefined();
  });

  test('⛔ si el navegador no deja leer localStorage, no lanza y manda el sistema', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError'); } };
    expect(() => runInitScript(blocked)).not.toThrow();
    expect(runInitScript(blocked)).toBeUndefined();
  });

  test('va con el nonce de la CSP del pedido', () => {
    const html = renderToStaticMarkup(createElement(CspNonceContext, { value: 'abc123' }, createElement(ThemeScript)));
    expect(html).toContain('nonce="abc123"');
    expect(html).toContain(THEME_STORAGE_KEY);
  });
});

describe('el botón del tema', () => {
  test('pasa al contrario del tema elegido', () => {
    expect(toggledTheme('dark', false)).toBe('light');
    expect(toggledTheme('light', true)).toBe('dark');
  });

  test('sin tema elegido, pasa al contrario del que muestra el sistema', () => {
    expect(toggledTheme(undefined, true)).toBe('light');
    expect(toggledTheme(undefined, false)).toBe('dark');
  });
});
