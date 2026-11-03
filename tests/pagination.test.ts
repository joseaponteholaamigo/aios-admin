// La paginación numerada de las listas (spec «Paginación numerada», CA-5 a CA-9, CB-1 y CB-2).
//
// EL DEFECTO QUE PREVIENE. Con la paginación de antes, soporte no sabía en qué página estaba ni
// cuántas había, y para llegar a la sexta tenía que pasar por las cinco anteriores. Si los números
// se calcularan mal, un número llevaría a una página que no es, o la fila saltaría de ancho al
// moverse; si un `?page=` raro llegara al backend, la pantalla se caería con un 422; y si el panel
// no tolerara el backend de antes, se caería durante el despliegue.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, test } from 'vitest';
import { rowsShown, type PageInfo } from '../app/domain/pagination';
import { ApiContractError } from '../app/shared/api/api-reading';
import { toPageInfo } from '../app/shared/api/page-mapping';
import { pageFrom, pageParam } from '../app/shared/routing/page-param';
import { pageItems } from '../app/shared/ui/page-items';
import { Pager } from '../app/shared/ui/pager';

const info = (page: number, total: number, perPage = 50): PageInfo => ({ page, pages: Math.max(1, Math.ceil(total / perPage)), total, perPage });

describe('qué números se ven (CA-6)', () => {
  test('con siete páginas o menos, todas', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('con más, la primera, la última, la actual con una a cada lado y «…» en cada hueco', () => {
    expect(pageItems(10, 20)).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
    expect(pageItems(1, 8)).toEqual([1, 2, 3, 4, 5, 'gap-end', 8]);
    expect(pageItems(4, 8)).toEqual([1, 2, 3, 4, 5, 'gap-end', 8]);
    expect(pageItems(5, 8)).toEqual([1, 'gap-start', 4, 5, 6, 7, 8]);
    expect(pageItems(20, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
  });

  test('⛔ con más de siete, en cualquier página son siete lugares, y siempre están la actual y sus vecinas', () => {
    const pages = 20;
    for (let current = 1; current <= pages; current += 1) {
      const items = pageItems(current, pages);
      expect(items, `página ${current}`).toHaveLength(7);
      const numbers = items.filter((i): i is number => typeof i === 'number');
      for (const must of [1, pages, current, Math.max(1, current - 1), Math.min(pages, current + 1)]) {
        expect(numbers, `página ${current}: falta ${must}`).toContain(must);
      }
      expect([...numbers].sort((a, b) => a - b), `página ${current}: desordenados`).toEqual(numbers);
    }
  });
});

describe('la página en la dirección (CA-8 y CB-2)', () => {
  test('un número de página se lee; lo demás, incluido un cursor viejo, es la primera', () => {
    expect(pageFrom(new URLSearchParams('page=6'))).toBe(6);
    for (const raw of ['', 'page=0', 'page=-1', 'page=2.5', 'page=abc', 'page=06', 'page=100000', 'cursor=eyJ2IjoxfQ']) {
      expect(pageFrom(new URLSearchParams(raw)), raw).toBe(1);
    }
  });

  test('la primera página no lleva el parámetro, así un enlace a ella es el de la lista sin más', () => {
    expect([pageParam(1), pageParam(3)]).toEqual([{}, { page: '3' }]);
  });
});

describe('la página que manda el backend (CA-1 y CB-1)', () => {
  test('se traduce a los nombres del panel', () => {
    expect(toPageInfo({ pagina: 2, paginas: 8, total: 377, porPagina: 50 }, 50)).toEqual({ page: 2, pages: 8, total: 377, perPage: 50 });
  });

  test('CB-1 · sin `paginacion`, lo que llegó es una sola página', () => {
    expect(toPageInfo(undefined, 12)).toEqual({ page: 1, pages: 1, total: 12, perPage: 12 });
  });

  test('una que no cuadra rompe el contrato, en vez de dibujar números que no existen', () => {
    for (const roto of [null, {}, { pagina: 9, paginas: 8, total: 377, porPagina: 50 }, { pagina: 1, paginas: 1, total: -1, porPagina: 50 }, { pagina: '1', paginas: 1, total: 0, porPagina: 50 }]) {
      expect(() => toPageInfo(roto, 0), JSON.stringify(roto)).toThrow(ApiContractError);
    }
  });

  test('las filas que muestra cada página, contando desde 1', () => {
    expect([rowsShown(info(1, 377)), rowsShown(info(2, 377)), rowsShown(info(8, 377)), rowsShown(info(1, 0))]).toEqual([
      { from: 1, to: 50 }, { from: 51, to: 100 }, { from: 351, to: 377 }, null,
    ]);
  });
});

/** Renderiza dentro de un router, porque los números son enlaces. */
function render(page: PageInfo) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Pager, { page, of: `${page.total} cuentas personales`, hrefOf: (n: number) => `?page=${n}` }) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/'] }));
}

describe('cómo se ve (CA-5, CA-7 y CA-9)', () => {
  test('CA-5 · dice qué filas muestra de cuántas, y cada número lleva a su página', () => {
    const html = render(info(6, 1000));
    expect(html).toContain('Mostrando 251–300 de 1000 cuentas personales');
    expect(html).toContain('href="/?page=5"');
    expect(html).toContain('href="/?page=20"');
    expect(html).toMatch(/<a[^>]*rel="prev"[^>]*>Anterior<\/a>/);
    expect(html).toMatch(/<a[^>]*rel="next"[^>]*>Siguiente<\/a>/);
    expect(html.match(/…/g)).toHaveLength(2);
  });

  test('CA-7 · la actual no es un enlace y lo dice; en los extremos, Anterior o Siguiente se desactivan', () => {
    const sexta = render(info(6, 1000));
    expect(sexta).toMatch(/<span[^>]*aria-current="page"[^>]*>6<\/span>/);
    expect(sexta).not.toContain('href="/?page=6"');
    const disabled = (label: string) => new RegExp(`<a (?![^>]*href)[^>]*aria-disabled="true"[^>]*>${label}</a>`);
    expect(render(info(1, 1000))).toMatch(disabled('Anterior'));
    expect(render(info(20, 1000))).toMatch(disabled('Siguiente'));
  });

  test('CA-9 · con una sola página, solo qué filas muestra; sin filas, nada', () => {
    const una = render(info(1, 12));
    expect(una).toContain('Mostrando 1–12 de 12 cuentas personales');
    expect(una).not.toContain('Siguiente');
    expect(render(info(1, 0))).toBe('');
  });
});
