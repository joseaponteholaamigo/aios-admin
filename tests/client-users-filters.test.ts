// La barra de filtros de Usuarios de clientes: la búsqueda por correo y la elección de empresa, que
// se aplican solas, y un solo botón para borrarlas (M2a; spec «Cuentas personales», CA-24).
//
// EL DEFECTO QUE PREVIENE. Si la barra tuviera un formulario, el texto del correo podría terminar en
// una dirección y quedar en los logs. Si la lista desplegable trajera cada cuenta personal como una
// opción, el equipo tendría que recorrer cientos para encontrar a un cliente real; y si dijera
// «Todas las empresas» cuando la URL trae una que no muestra, filtraría a ciegas.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import type { CompanyOption } from '../app/domain/client-users';
import { ClientUsersFilters, type CompanyChoice } from '../app/modules/client-users/components/client-users-filters';

const COMPANIES: CompanyOption[] = [
  { id: 'auteco-000001', name: 'Auteco', kind: 'company' },
  { id: 'prisier-000002', name: 'Prisier', kind: 'company' },
  { id: 'webinar-000003', name: 'Webinar 20261028 a1', kind: 'personal' },
  { id: 'webinar-000004', name: 'Webinar 20261028 a2', kind: 'personal' },
];

const noop = () => {};
const filters = ({ choice = { kind: 'all' } as CompanyChoice, text = '' } = {}) =>
  renderToStaticMarkup(createElement(ClientUsersFilters, { companies: COMPANIES, choice, text, onTextChange: noop, onChoiceChange: noop, onClearAll: noop }));

/** Las opciones de la lista desplegable en orden, con el grupo en el que van (o `null` fuera de un grupo). */
function optionsOf(html: string) {
  const select = html.match(/<select[\s\S]*?<\/select>/)?.[0] ?? '';
  const parts = [...select.matchAll(/<optgroup label="([^"]+)">|<\/optgroup>|<option value="([^"]*)"[^>]*>([^<]+)<\/option>/g)];
  let group: string | null = null;
  return parts.flatMap(([whole, label, , text]) => {
    if (label) { group = label; return []; }
    if (whole === '</optgroup>') { group = null; return []; }
    return [{ group, text }];
  });
}

describe('la barra de filtros', () => {
  test('⛔ no tiene formularios ni botón de buscar o filtrar: nada de la barra manda el texto en una dirección', () => {
    const html = filters({ choice: { kind: 'company', id: 'auteco-000001' }, text: 'ana' });
    expect(html).not.toContain('<form');
    expect(html).not.toMatch(/>(Buscar|Filtrar)</);
    expect(html).toMatch(/<input[^>]*maxLength="254"/);
  });

  test('la X para borrar el texto aparece dentro del buscador solo cuando hay texto', () => {
    expect(filters({ text: 'ana' })).toMatch(/<label class="adm-search[^"]*">[\s\S]*<button[^>]*aria-label="Borrar la búsqueda"[\s\S]*<\/label>/);
    expect(filters()).not.toContain('Borrar la búsqueda');
  });

  test('«Borrar filtros» aparece con texto, con una empresa o con las cuentas personales, y sin filtros no', () => {
    expect(filters({ text: 'ana' })).toContain('Borrar filtros');
    expect(filters({ choice: { kind: 'company', id: 'prisier-000002' } })).toContain('Borrar filtros');
    expect(filters({ choice: { kind: 'personal' } })).toContain('Borrar filtros');
    expect(filters()).not.toContain('Borrar filtros');
  });

  test('CA-24 · las cuentas personales son una sola opción, antes del grupo de las empresas', () => {
    expect(optionsOf(filters())).toEqual([
      { group: null, text: 'Todas las empresas' },
      { group: null, text: 'Solo cuentas personales (2)' },
      { group: 'Empresas (2)', text: 'Auteco' },
      { group: 'Empresas (2)', text: 'Prisier' },
    ]);
  });

  test('la opción elegida se marca, sea una empresa o las cuentas personales; sin filtro, nada', () => {
    expect(filters({ choice: { kind: 'personal' } })).toMatch(/<select[^>]*class="on"[\s\S]*<option value="[^"]+" selected="">Solo cuentas personales/);
    expect(filters({ choice: { kind: 'company', id: 'prisier-000002' } })).toMatch(/<option value="prisier-000002" selected="">Prisier/);
    expect(filters()).not.toMatch(/<select[^>]*class="on"/);
  });

  test('⛔ un id en la URL que no está en la lista se muestra elegido, en vez de «Todas las empresas»', () => {
    expect(filters({ choice: { kind: 'company', id: 'borrada-000009' } })).toMatch(/<option value="borrada-000009" selected="">borrada-000009<\/option>/);
  });
});
