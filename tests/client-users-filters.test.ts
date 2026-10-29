// La barra de filtros de Usuarios de clientes: la búsqueda por correo y el filtro por empresa.
//
// EL DEFECTO QUE PREVIENE. Si el correo cayera en el formulario GET, viajaría en la URL y quedaría
// en los logs y en el historial del navegador. Si la lista desplegable mezclara los clientes reales
// con los cientos de empresas de un solo asiento, o dijera «Todas las empresas» cuando la URL trae
// una que no muestra, el equipo filtraría a ciegas.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, test } from 'vitest';
import type { CompanyOption } from '../app/domain/client-users';
import { ClientUsersFilters } from '../app/modules/client-users/components/client-users-filters';

const COMPANIES: CompanyOption[] = [
  { id: 'auteco-000001', name: 'Auteco', hasTeam: true },
  { id: 'prisier-000002', name: 'Prisier', hasTeam: true },
  { id: 'webinar-000003', name: 'Webinar 20261028 a1', hasTeam: false },
];

function filters(company = '', emailError: string | null = null) {
  const Component = () => createElement(ClientUsersFilters, { companies: COMPANIES, company, searching: false, emailError });
  const Stub = createRoutesStub([{ path: '*', Component }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/client-users'] }));
}

/** Los formularios de la barra, cada uno con su método y su contenido. */
const formsOf = (html: string) => [...html.matchAll(/<form[^>]*method="(get|post)"[^>]*>([\s\S]*?)<\/form>/g)].map(([, method, body]) => ({ method, body: body ?? '' }));

describe('la barra de filtros', () => {
  test('⛔ el correo va solo en el formulario POST, y el GET lleva solo la empresa', () => {
    const forms = formsOf(filters('auteco-000001'));
    expect(forms.map((f) => f.method)).toEqual(['post', 'get']);
    const [post, get] = forms;
    expect(post?.body).toContain('name="email"');
    expect(post?.body).not.toContain('name="company"');
    expect(get?.body).toContain('name="company"');
    expect(get?.body).not.toContain('name="email"');
    expect(get?.body).not.toContain('name="cursor"');
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

  test('con una empresa elegida, la lista la marca y aparece «Quitar filtro»; sin filtro, ninguno de los dos', () => {
    const chosen = filters('prisier-000002');
    expect(chosen).toMatch(/<select[^>]*class="on"/);
    expect(chosen).toContain('Quitar filtro');
    const none = filters();
    expect(none).not.toMatch(/<select[^>]*class="on"/);
    expect(none).not.toContain('Quitar filtro');
  });

  test('⛔ un id en la URL que no está en la lista se muestra elegido, en vez de «Todas las empresas»', () => {
    expect(filters('borrada-000009')).toMatch(/<option value="borrada-000009" selected="">borrada-000009<\/option>/);
  });

  test('un correo inválido queda marcado y enlazado a su mensaje, que se anuncia', () => {
    const html = filters('', 'Escribe un correo completo, como persona@empresa.com.');
    expect(html).toMatch(/<input[^>]*aria-invalid="true"[^>]*aria-describedby="client-users-email-error"/);
    expect(html).toMatch(/<p id="client-users-email-error"[^>]*role="alert"[^>]*>Escribe un correo completo/);
  });
});
