// El aviso de que el panel muestra solo algunas empresas (CA-4 de M2a).
//
// EL DEFECTO QUE PREVIENE. Mientras el filtro esté puesto, una lista vacía o corta no quiere decir
// que no haya más clientes. Sin el aviso, el equipo concluiría que una empresa no existe; con el
// aviso de más, creería que falta algo cuando ya se ve todo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { FilterNotice } from '../app/shared/layout/filter-notice';

describe('el aviso del filtro', () => {
  test('con el filtro puesto, avisa que se ven solo las empresas de prueba', () => {
    expect(renderToStaticMarkup(createElement(FilterNotice, { onlySome: true }))).toContain('Por ahora el panel muestra solo las empresas de prueba');
  });

  test('con el filtro levantado, no aparece', () => {
    expect(renderToStaticMarkup(createElement(FilterNotice, { onlySome: false }))).toBe('');
  });
});
