// La raíz elige el marco: con sesión, el del panel; sin sesión, el público (CA-23).
//
// EL DEFECTO QUE PREVIENE. Si la raíz montara el marco del panel sin sesión, el login fallido y
// «sin acceso» mostrarían un menú vacío y una barra con nadie; si no lo montara con sesión, las
// pantallas quedarían sin menú ni salida. Las pruebas del marco lo pintan suelto: esta mira que la
// raíz lo use.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, test } from 'vitest';
import App from '../app/root';

type RootData = { nonce: string; member: { name: string; isSuperadmin: boolean } | null; menu: unknown[] };

function renderRoot(data: RootData) {
  const Stub = createRoutesStub([
    { id: 'root', path: '/', Component: App as never, children: [{ index: true, Component: () => createElement('p', null, 'la página') }] },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/'], hydrationData: { loaderData: { root: data } } }));
}

describe('el marco que monta la raíz', () => {
  test('con sesión: el marco del panel, con la página adentro', () => {
    const html = renderRoot({
      nonce: '',
      member: { name: 'Ana', isSuperadmin: false },
      menu: [{ path: '/', label: 'Inicio', group: 'administration', icon: 'fleet' }],
    });
    expect(html).toContain('class="adm-side');
    expect(html).toMatch(/<main class="adm-page"><p>la página<\/p><\/main>/);
    expect(html).not.toContain('adm-public');
  });

  test('sin sesión: el marco público, sin menú', () => {
    const html = renderRoot({ nonce: '', member: null, menu: [] });
    expect(html).toContain('class="adm-public"');
    expect(html).toContain('<p>la página</p>');
    expect(html).not.toContain('adm-side');
  });
});
