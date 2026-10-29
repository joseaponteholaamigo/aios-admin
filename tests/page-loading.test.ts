// Cuándo el panel muestra el esqueleto de carga.
//
// EL DEFECTO QUE PREVIENE. Si no saliera al cambiar de pantalla, la anterior se queda quieta hasta
// que el backend responde y la persona cree que el panel falló. Si saliera después de una búsqueda
// por POST, taparía el resultado que acaba de llegar.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { isPageLoading } from '../app/shared/layout/page-loading';
import { PageSkeleton } from '../app/shared/layout/page-skeleton';

describe('el esqueleto de carga', () => {
  test('sale al ir a otra pantalla, a otra página de una lista o al buscar por GET', () => {
    expect(isPageLoading({ state: 'loading', formMethod: undefined })).toBe(true);
    expect(isPageLoading({ state: 'loading', formMethod: 'GET' })).toBe(true);
  });

  test('⛔ no sale mientras se envía un formulario ni cuando recarga después de un POST', () => {
    expect(isPageLoading({ state: 'submitting', formMethod: 'POST' })).toBe(false);
    expect(isPageLoading({ state: 'loading', formMethod: 'POST' })).toBe(false);
    expect(isPageLoading({ state: 'idle', formMethod: undefined })).toBe(false);
  });

  test('le dice «Cargando…» a un lector de pantalla, sin estilos en línea que la CSP bloquearía', () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton));
    expect(html).toContain('role="status"');
    expect(html).toContain('Cargando…');
    expect(html).not.toContain('style=');
  });
});
