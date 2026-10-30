// La barra de filtros y las pestañas de Empresas (spec «Cuentas personales», CA-18 a CA-20).
//
// EL DEFECTO QUE PREVIENE. Si la barra tuviera un formulario o un botón de buscar, no funcionaría
// como la de Usuarios de clientes, y el texto podría terminar en una dirección. Si la lista de planes
// ofreciera uno sin cuentas, el equipo filtraría para no encontrar nada; y si escondiera el plan
// elegido, diría «Todos los planes» con un filtro puesto.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, test } from 'vitest';
import type { AccountKind, KindCount, ListPlan } from '../app/domain/companies';
import { CompaniesFilters } from '../app/modules/companies/components/companies-filters';
import { CompanyTabs } from '../app/modules/companies/components/company-tabs';

const PERSONALES: KindCount = { total: 381, plans: { free: 0, pro: 4, team: 0, custom: 377 } };
const noop = () => {};
const filters = ({ kind = 'personal' as AccountKind, plan = null as ListPlan | null, text = '' } = {}) =>
  renderToStaticMarkup(createElement(CompaniesFilters, { kind, counts: PERSONALES, plan, text, onTextChange: noop, onPlanChange: noop, onClearAll: noop }));

const optionsOf = (html: string) => [...(html.match(/<select[\s\S]*?<\/select>/)?.[0] ?? '').matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map((m) => m[1]);

describe('la barra de filtros de Empresas', () => {
  test('⛔ CA-19 · no tiene formularios ni botón de buscar: se aplica sola, como Usuarios de clientes', () => {
    const html = filters({ text: 'maria', plan: 'pro' });
    expect(html).not.toContain('<form');
    expect(html).not.toMatch(/>(Buscar|Filtrar)</);
    expect(html).toMatch(/<input[^>]*maxLength="254"/);
    expect(html).toMatch(/<label class="adm-search[^"]*">[\s\S]*aria-label="Borrar la búsqueda"[\s\S]*<\/label>/);
  });

  test('el buscador dice qué se busca en cada pestaña', () => {
    expect(filters({ kind: 'personal' })).toContain('placeholder="Buscar por correo"');
    expect(filters({ kind: 'company' })).toContain('placeholder="Buscar por nombre o id"');
  });

  test('CA-20 · ofrece solo los planes que tienen cuentas en esta pestaña, con cuántas', () => {
    expect(optionsOf(filters())).toEqual(['Todos los planes', 'Pro (4)', 'Personalizado (377)']);
  });

  test('el plan elegido se marca y se ofrece aunque no tenga cuentas', () => {
    const html = filters({ plan: 'team' });
    expect(html).toMatch(/<select[^>]*class="on"/);
    expect(html).toMatch(/<option value="team" selected="">Team \(0\)<\/option>/);
    expect(filters()).not.toMatch(/<select[^>]*class="on"/);
  });

  test('«Borrar filtros» aparece con texto o con un plan, y sin filtros no', () => {
    expect(filters({ text: 'maria' })).toContain('Borrar filtros');
    expect(filters({ plan: 'pro' })).toContain('Borrar filtros');
    expect(filters()).not.toContain('Borrar filtros');
  });
});

describe('las pestañas', () => {
  const tabs = (kind: AccountKind) => {
    const counts = { companies: { total: 15, plans: PERSONALES.plans }, personal: PERSONALES };
    const Stub = createRoutesStub([{ path: '*', Component: () => createElement(CompanyTabs, { kind, counts }) }]);
    return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/companies'] }));
  };

  test('CA-18 · dos pestañas con cuántas cuentas tiene cada una, y la elegida marcada', () => {
    const html = tabs('company');
    expect([...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2]])).toEqual([
      ['/companies', 'Empresas (15)'],
      ['/companies?kind=personal', 'Cuentas personales (381)'],
    ]);
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>Empresas \(15\)/);
    expect(tabs('personal')).toMatch(/<a[^>]*aria-current="page"[^>]*>Cuentas personales \(381\)/);
  });
});
