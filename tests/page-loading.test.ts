// Cuándo el panel muestra que algo carga, y cómo.
//
// EL DEFECTO QUE PREVIENE. Si no se notara al cambiar de pantalla, la anterior se queda quieta hasta
// que el backend responde y la persona cree que el panel falló. Si al cambiar un filtro de la misma
// pantalla saliera el esqueleto, se borraría lo que la persona está escribiendo en el buscador. Y si
// saliera después de un envío por POST, taparía el resultado que acaba de llegar.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { pageLoading } from '../app/shared/layout/page-loading';
import { PageSkeleton } from '../app/shared/layout/page-skeleton';

const loading = (pathname: string, formMethod?: 'GET' | 'POST') => ({ state: 'loading' as const, formMethod, location: { pathname } as never });

describe('lo que se nota mientras carga', () => {
  test('ir a otra pantalla saca el esqueleto', () => {
    expect(pageLoading(loading('/companies'), '/client-users')).toBe('other-screen');
  });

  test('⛔ otros filtros u otra página de la misma pantalla la dejan quieta y atenuada, sin esqueleto', () => {
    expect(pageLoading(loading('/client-users'), '/client-users')).toBe('same-screen');
    expect(pageLoading(loading('/companies', 'GET'), '/companies')).toBe('same-screen');
  });

  test('⛔ ni al enviar un formulario ni al recargar después de un POST', () => {
    expect(pageLoading({ state: 'submitting', formMethod: 'POST', location: { pathname: '/x' } as never }, '/x')).toBeNull();
    expect(pageLoading(loading('/x', 'POST'), '/x')).toBeNull();
    expect(pageLoading({ state: 'idle', formMethod: undefined, location: undefined }, '/x')).toBeNull();
  });

  test('el esqueleto le dice «Cargando…» a un lector de pantalla, sin estilos en línea que la CSP bloquearía', () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton));
    expect(html).toContain('role="status"');
    expect(html).toContain('Cargando…');
    expect(html).not.toContain('style=');
  });
});
