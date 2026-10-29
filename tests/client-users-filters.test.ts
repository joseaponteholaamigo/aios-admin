// La barra de filtros de Usuarios de clientes: la búsqueda por correo y la empresa, que se aplican
// solas, y un solo botón para borrarlas.
//
// EL DEFECTO QUE PREVIENE. Si la barra tuviera un formulario, el texto del correo podría terminar en
// una dirección y quedar en los logs y en el historial. Si la lista desplegable mezclara los clientes
// reales con los cientos de empresas de un solo asiento, o dijera «Todas las empresas» cuando la URL
// trae una que no muestra, el equipo filtraría a ciegas. Y sin la X ni «Borrar filtros» a la vista,
// no habría cómo volver a la lista completa.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import type { CompanyOption } from '../app/domain/client-users';
import { ClientUsersFilters } from '../app/modules/client-users/components/client-users-filters';

const COMPANIES: CompanyOption[] = [
  { id: 'auteco-000001', name: 'Auteco', hasTeam: true },
  { id: 'prisier-000002', name: 'Prisier', hasTeam: true },
  { id: 'webinar-000003', name: 'Webinar 20261028 a1', hasTeam: false },
];

const noop = () => {};
const filters = ({ company = '', text = '' } = {}) =>
  renderToStaticMarkup(createElement(ClientUsersFilters, { companies: COMPANIES, company, text, onTextChange: noop, onCompanyChange: noop, onClearAll: noop }));

describe('la barra de filtros', () => {
  test('⛔ no tiene formularios ni botón de buscar o filtrar: nada de la barra manda el texto en una dirección', () => {
    const html = filters({ company: 'auteco-000001', text: 'ana' });
    expect(html).not.toContain('<form');
    expect(html).not.toMatch(/>(Buscar|Filtrar)</);
    expect(html).toMatch(/<input[^>]*maxLength="254"/);
  });

  test('la X para borrar el texto aparece dentro del buscador solo cuando hay texto', () => {
    expect(filters({ text: 'ana' })).toMatch(/<label class="adm-search[^"]*">[\s\S]*<button[^>]*aria-label="Borrar la búsqueda"[\s\S]*<\/label>/);
    expect(filters()).not.toContain('Borrar la búsqueda');
  });

  test('«Borrar filtros» aparece con texto o con una empresa, y sin ningún filtro no', () => {
    expect(filters({ text: 'ana' })).toContain('Borrar filtros');
    expect(filters({ company: 'prisier-000002' })).toContain('Borrar filtros');
    expect(filters()).not.toContain('Borrar filtros');
  });

  test('las empresas con equipo van primero y aparte de las de un solo asiento, cada grupo con cuántas tiene', () => {
    const html = filters();
    const groups = [...html.matchAll(/<optgroup label="([^"]+)">([\s\S]*?)<\/optgroup>/g)].map(([, label, body]) => ({
      label, options: [...(body ?? '').matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map((m) => m[1]),
    }));
    expect(groups).toEqual([
      { label: 'Empresas con equipo (2)', options: ['Auteco', 'Prisier'] },
      { label: 'Empresas de un solo asiento (1)', options: ['Webinar 20261028 a1'] },
    ]);
    expect(html).toMatch(/<option value=""[^>]*>Todas las empresas<\/option>/);
  });

  test('con una empresa elegida, la lista la marca; sin filtro, no', () => {
    expect(filters({ company: 'prisier-000002' })).toMatch(/<select[^>]*class="on"/);
    expect(filters()).not.toMatch(/<select[^>]*class="on"/);
  });

  test('⛔ un id en la URL que no está en la lista se muestra elegido, en vez de «Todas las empresas»', () => {
    expect(filters({ company: 'borrada-000009' })).toMatch(/<option value="borrada-000009" selected="">borrada-000009<\/option>/);
  });
});
