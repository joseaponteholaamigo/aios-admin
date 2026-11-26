// «Reglas de acceso» de una empresa desde el panel (spec «Reglas de acceso», CA-11 a CA-14).
//
// EL DEFECTO QUE PREVIENE. Que el panel le mande al backend los nombres del panel en vez de los suyos, o
// que «Ver el cambio» no lleve `soloVer` (y guarde) o «Guardar» no lleve `confirmo` (y no pueda dejar a la
// empresa vacía aunque se confirmó); que «Guardar» guarde algo distinto de lo que se vio; que «Volver a la
// base» mande otra operación que borrar esa regla; que la pantalla lea mal lo que entra y sale, o a cuántas
// personas les cambia; que a un plan que no es Personalizado se le ofrezca un formulario que el backend va a
// rechazar; que un «falta publicar» se vea como «el backend no respondió»; y que un rechazo se pierda, deje
// la pantalla sin botón o, tras un conflicto, deje a la vista una vista previa que ya no es cierta.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { WriteRejection } from '../app/domain/account-creation';
import type { AccessChangeResult, CompanyAccessReading, CompanyAccessRules } from '../app/domain/access-rules';
import type { CompanyFile } from '../app/domain/companies';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { toWriteRejection } from '../app/shared/api/write-mapping';
import { rejectionMessage } from '../app/shared/labels/write-rejection-labels';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';
import { accessChangeFingerprint, readAccessChange, type AccessAttempt, type AccessRequest } from '../app/modules/companies/access-change-form-data';
import { CONFLICT_MESSAGE, NOT_CUSTOM_REASON, accessSavedNotice, accessSavedNoticeParams } from '../app/modules/companies/access-change-labels';
import { teamMember } from './helpers/fake-admin-api';

const changeAccess = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeAccess }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({}) }));
const accessRoute = await import('../app/modules/companies/routes/company-access');
const { AccessRulesEditor } = await import('../app/modules/companies/components/access-rules-editor');
const { CompanyAccessCard } = await import('../app/modules/companies/components/company-access-card');

const ID = 'auteco-4d5e6f';
const editora = teamMember('ana', { permissions: { companies: 'edit' } });

/** La respuesta del `GET …/acceso` del contrato, con una skill sin `label` y una regla que ya no existe. */
const GET_BODY = {
  tenantId: ID, personalizado: true, base: 'nada',
  reglas: [
    { clave: 'dominio:convert', accion: 'dar', inexistente: false, inactiva: false },
    { clave: 'skill:vieja', accion: 'quitar', inexistente: true, inactiva: false },
  ],
  recibe: { skills: 12, agentes: 1, cadenas: 2 },
  catalogo: {
    dominios: [{ slug: 'convert', nombre: { es: 'Convertir', en: 'Convert' }, skills: 9, recibe: 9 }],
    skills: [
      { nombre: 'copy', label: { es: 'Copy de página', en: 'Page copy' }, dominio: 'convert', recibe: true },
      { nombre: 'page-cro', label: null, dominio: 'convert', recibe: false },
    ],
  },
};

/** La respuesta 200 del `POST …/acceso` del contrato. */
const POST_BODY = {
  tenantId: ID, soloVer: true, cambio: true,
  reglas: { antes: { 'dominio:convert': 'dar' }, despues: {} },
  sale: { skills: ['copy'], agentes: ['sales'], cadenas: [] },
  entra: { skills: [], agentes: [], cadenas: [] },
  personasAfectadas: 3, reglasInactivas: 1, confirmar: ['vacio'],
};

const ACCESS: CompanyAccessRules = {
  custom: true, base: 'nothing',
  rules: [{ target: { kind: 'domain', name: 'convert' }, action: 'grant', missing: false, inactive: false }],
  receives: { skills: 12, agents: 1, chains: 2 },
  catalog: {
    domains: [{ slug: 'convert', name: 'Convertir', skills: 9, received: 9 }],
    skills: [{ name: 'copy', label: 'Copy de página', domain: 'convert', received: true }, { name: 'page-cro', label: null, domain: 'convert', received: false }],
  },
};

const PREVIEW: AccessChangeResult = {
  previewOnly: true, changed: true,
  leaves: { skills: ['copy'], agents: ['sales'], chains: [] }, enters: { skills: [], agents: [], chains: [] },
  affectedPeople: 3, inactiveRules: 1, toConfirm: ['empty'],
};

function formOf(fields: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of fields) f.append(k, v);
  return f;
}

function contextOf(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

const post = (fields: [string, string][]) => accessRoute.action({
  request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}/access`, { method: 'POST', body: formOf(fields) }),
  context: contextOf(editora), params: { companyId: ID },
} as never);

function render<P extends object>(Component: ComponentType<P>, props: P) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/companies/${ID}/access`] }));
}

const renderEditor = (attempt: AccessAttempt | null = null) => render(AccessRulesEditor, { companyId: ID, access: ACCESS, attempt });
const renderPage = (reading: CompanyAccessReading, planBlocked = false) => render(accessRoute.default as ComponentType<object>, {
  loaderData: { company: { id: ID, title: 'Auteco' }, planBlocked, reading },
});

/** El botón entero, por su nombre y su valor: React ordena los atributos a su modo. */
const button = (html: string, name: string, value: string) =>
  html.match(new RegExp(`<button(?=[^>]*name="${name}")(?=[^>]*value="${value}")[^>]*>[^<]*</button>`))?.[0] ?? '';

/** Un atributo como lo lee el navegador: la huella es JSON, y en el HTML sus comillas van escapadas. */
const unescapeHtml = (text: string) => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Lo que manda el formulario: dar el dominio `convert` y la skill `copy`. */
const A_GRANT: [string, string][] = [['action', 'grant'], ['target', 'domain:convert'], ['target', 'skill:copy'], ['reason', 'contrató ventas']];
const GRANT_REQUEST: AccessRequest = { action: 'grant', targets: [{ kind: 'domain', name: 'convert' }, { kind: 'skill', name: 'copy' }], reason: 'contrató ventas' };

beforeEach(() => {
  changeAccess.mockReset();
});

describe('CA-11 · cómo se llega', () => {
  test('⛔ la ruta exige «editar» en Empresas', () => {
    expect(ROUTE_TABLE.find((r) => r.path === 'companies/:companyId/access')?.access).toEqual({ module: 'companies', level: 'edit' });
  });

  test('⛔ la ficha enlaza a «Reglas de acceso» a quien edita un Personalizado; en otro plan, dice por qué y enlaza a «Cambiar plan»', () => {
    const file = { id: ID, plan: 'custom', access: { base: 'nothing', rules: [], counts: { skills: 0, agents: 0, chains: 0 } }, accessPending: null } as unknown as CompanyFile;
    const tarjeta = (f: CompanyFile, canEdit: boolean, planBlocked = false) => render(CompanyAccessCard, { file: f, canEdit, planBlocked });
    expect(tarjeta(file, true)).toContain(`href="/companies/${ID}/access"`);
    expect(tarjeta(file, false)).not.toContain(`/companies/${ID}/access`);
    const free = tarjeta({ ...file, plan: 'free' }, true);
    expect(free).toContain(NOT_CUSTOM_REASON);
    expect(free).toContain(`href="/companies/${ID}/plan"`);
    expect(free).not.toContain(`/companies/${ID}/access`);
    expect(tarjeta({ ...file, plan: 'team' }, true, true)).not.toContain(`/companies/${ID}/plan`);
  });

  test('⛔ en un plan que no es Personalizado la pantalla no ofrece el formulario: manda a «Cambiar plan»', () => {
    const html = renderPage({ published: true, access: { ...ACCESS, custom: false } });
    expect(html).toContain(NOT_CUSTOM_REASON);
    expect(html).toContain(`href="/companies/${ID}/plan"`);
    expect(html).not.toContain('Ver el cambio');
    expect(html).not.toContain('Volver a la base</button>');
  });

  test('si falta publicar algo, la pantalla lo dice en vez de mostrar reglas a medias', () => {
    const html = renderPage({ published: false, missing: 'no está publicada la receta del plan' });
    expect(html).toContain('No se pueden calcular sus reglas: no está publicada la receta del plan.');
    expect(html).not.toContain('Ver el cambio');
  });
});

describe('lo que se lee del backend', () => {
  const readApi = (status: number, body: unknown) => createAdminReadApi({
    baseUrl: 'https://api.example', log: () => {},
    fetchImpl: (async () => Response.json(body, { status })) as unknown as typeof fetch,
  });

  test('⛔ el GET llega con los nombres del panel: reglas con su estado, cuánto recibe y el catálogo con el nombre visible en español', async () => {
    const r = await readApi(200, GET_BODY).getCompanyAccess('t', ID);
    expect(r).toEqual({
      kind: 'ok',
      value: {
        published: true,
        access: {
          custom: true, base: 'nothing',
          rules: [
            { target: { kind: 'domain', name: 'convert' }, action: 'grant', missing: false, inactive: false },
            { target: { kind: 'skill', name: 'vieja' }, action: 'remove', missing: true, inactive: false },
          ],
          receives: { skills: 12, agents: 1, chains: 2 },
          catalog: {
            domains: [{ slug: 'convert', name: 'Convertir', skills: 9, received: 9 }],
            skills: [{ name: 'copy', label: 'Copy de página', domain: 'convert', received: true }, { name: 'page-cro', label: null, domain: 'convert', received: false }],
          },
        },
      },
    });
  });

  test('⛔ un 503 `sin-catalogo` es «falta publicar», con qué; otro 503 sigue siendo el backend que no respondió', async () => {
    const sinCatalogo = await readApi(503, { codigo: 'sin-catalogo', error: 'no está publicado dependencias.json' }).getCompanyAccess('t', ID);
    expect(sinCatalogo).toEqual({ kind: 'ok', value: { published: false, missing: 'no está publicado dependencias.json' } });
    await expect(readApi(503, { message: 'Service Unavailable' }).getCompanyAccess('t', ID)).rejects.toBeInstanceOf(AdminApiUnavailableError);
  });
});

describe('CA-13 · el pedido y su respuesta', () => {
  test('⛔ va por POST en los nombres del backend: ver lleva `soloVer`, guardar lleva `confirmo`, y la respuesta llega leída', async () => {
    const seen: { url: string; method: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
      return Response.json(POST_BODY);
    }) as unknown as typeof fetch;
    const api = createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} });
    const r = await api.changeAccess('t', ID, { ...GRANT_REQUEST, reason: '', previewOnly: true });
    await api.changeAccess('t', ID, { action: 'remove', targets: [{ kind: 'domain', name: 'convert' }], reason: 'bajó el contrato', previewOnly: false });
    expect(seen).toEqual([
      { url: `https://api.example/v1/admin/clientes/${ID}/acceso`, method: 'POST', body: { operaciones: [{ accion: 'dar', clave: 'dominio:convert' }, { accion: 'dar', clave: 'skill:copy' }], soloVer: true } },
      { url: `https://api.example/v1/admin/clientes/${ID}/acceso`, method: 'POST', body: { operaciones: [{ accion: 'quitar', clave: 'dominio:convert' }], motivo: 'bajó el contrato', confirmo: true } },
    ]);
    expect(r).toEqual({ kind: 'ok', value: PREVIEW });
  });

  test('una confirmación que el panel no conoce no se pierde: queda como «algo más que confirmar»', async () => {
    const api = createAdminWriteApi({ baseUrl: 'https://api.example', log: () => {}, fetchImpl: (async () => Response.json({ ...POST_BODY, confirmar: ['otra-cosa'] })) as unknown as typeof fetch });
    const r = await api.changeAccess('t', ID, { action: 'grant', targets: [{ kind: 'skill', name: 'copy' }], reason: '', previewOnly: true });
    expect(r.kind === 'ok' && r.value.toConfirm).toEqual(['unknown']);
  });
});

describe('CA-12 · lo que manda el formulario', () => {
  test('⛔ una misma acción para todo lo elegido, sin repetir', () => {
    expect(readAccessChange(formOf([...A_GRANT, ['target', 'skill:copy']]))).toEqual({ change: GRANT_REQUEST });
  });

  test('⛔ «Volver a la base» de una regla es borrar esa regla, y nada más de lo marcado', () => {
    expect(readAccessChange(formOf([['reset', 'domain:convert']]))).toEqual({ change: { action: 'reset', targets: [{ kind: 'domain', name: 'convert' }], reason: '' } });
  });

  test('sin nada elegido, o con algo que no es un dominio ni una skill, se dice junto al catálogo y no se llama a la API', async () => {
    const vacio = (await post([['action', 'grant'], ['reason', '']])) as AccessAttempt;
    expect(vacio.errors).toEqual({ targets: 'Elige al menos un dominio o una skill.' });
    expect(readAccessChange(formOf([['action', 'grant'], ['target', 'rol:ventas']]))).toEqual({ errors: { targets: 'Lo elegido no se entiende: vuelve a cargar la página.' } });
    expect(changeAccess).not.toHaveBeenCalled();
  });
});

describe('CA-13 · los dos pasos', () => {
  test('⛔ «Ver el cambio» pide la vista previa y vuelve con ella y su huella, sin guardar', async () => {
    changeAccess.mockResolvedValue({ kind: 'ok', value: PREVIEW });
    const r = (await post([...A_GRANT, ['intent', 'preview']])) as AccessAttempt;
    expect(changeAccess).toHaveBeenCalledWith('token', ID, { ...GRANT_REQUEST, previewOnly: true });
    expect(r.shown).toMatchObject({ request: GRANT_REQUEST, previewed: accessChangeFingerprint(GRANT_REQUEST), stale: false });
  });

  test('⛔ «Guardar» manda el mismo pedido con la confirmación y vuelve a la pantalla con el aviso', async () => {
    changeAccess.mockResolvedValue({ kind: 'ok', value: { ...PREVIEW, previewOnly: false } });
    const r = (await post([...A_GRANT, ['intent', 'save'], ['previewed', accessChangeFingerprint(GRANT_REQUEST)]])) as Response;
    expect(changeAccess).toHaveBeenCalledWith('token', ID, { ...GRANT_REQUEST, previewOnly: false });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}/access?aviso=acceso`);
    expect(accessSavedNotice(new URLSearchParams(r.headers.get('Location')?.split('?')[1]))).toMatch(/^Se guardaron las reglas de acceso\./);
  });

  test('⛔ si lo que llega no es lo que se vio, «Guardar» no guarda: muestra la vista previa nueva', async () => {
    changeAccess.mockResolvedValue({ kind: 'ok', value: PREVIEW });
    const viejo = accessChangeFingerprint({ ...GRANT_REQUEST, action: 'remove' });
    const r = (await post([...A_GRANT, ['intent', 'save'], ['previewed', viejo]])) as AccessAttempt;
    expect(changeAccess).toHaveBeenCalledWith('token', ID, expect.objectContaining({ previewOnly: true }));
    expect(r.shown?.stale).toBe(true);
  });

  test('⛔ la vista previa dice qué sale, a cuántas personas les cambia, cuántas reglas quedan inactivas y qué se confirma', () => {
    const html = renderEditor({ values: { action: 'grant', targets: [], reason: '' }, errors: {}, rejection: null, shown: { preview: PREVIEW, request: GRANT_REQUEST, previewed: 'huella', stale: false } });
    expect(html).toContain('Skills que salen · 1');
    expect(html).toContain('Copy de página (copy)');
    expect(html).toContain('Agentes que dejan de estar completos · 1');
    expect(html).toContain('A 3 personas les cambia lo que reciben.');
    expect(html).toContain('1 regla de sus roles o personas queda inactiva');
    expect(html).toContain('La empresa queda sin ninguna skill');
    expect(button(html, 'intent', 'save')).toMatch(/>Confirmar y guardar</);
    // «Guardar» lleva el pedido que se vio, con su huella.
    expect(html).toContain('<input type="hidden" name="previewed" value="huella"/>');
    expect(html).toContain('<input type="hidden" name="target" value="domain:convert"/>');
  });

  test('⛔ la vista previa de «Volver a la base» se guarda como borrar esa regla', async () => {
    changeAccess.mockResolvedValue({ kind: 'ok', value: PREVIEW });
    const vista = (await post([['reset', 'domain:convert']])) as AccessAttempt;
    expect(changeAccess).toHaveBeenLastCalledWith('token', ID, { action: 'reset', targets: [{ kind: 'domain', name: 'convert' }], reason: '', previewOnly: true });
    // Lo que manda su «Guardar»: los campos ocultos que pinta la vista previa.
    const html = renderEditor(vista);
    const hidden = [...(html.match(/<form[^>]*class="access-preview__save"[\s\S]*?<\/form>/)?.[0] ?? '').matchAll(/<input type="hidden" name="(\w+)" value="([^"]*)"\/>/g)]
      .map((m) => [m[1] ?? '', unescapeHtml(m[2] ?? '')] as [string, string]);
    expect(hidden.length).toBeGreaterThan(0);
    changeAccess.mockResolvedValue({ kind: 'ok', value: { ...PREVIEW, previewOnly: false } });
    const r = (await post([...hidden, ['intent', 'save']])) as Response;
    expect(changeAccess).toHaveBeenLastCalledWith('token', ID, { action: 'reset', targets: [{ kind: 'domain', name: 'convert' }], reason: '', previewOnly: false });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}/access?aviso=acceso`);
  });

  test('una vista previa sin cambios lo dice y no ofrece guardar', () => {
    const html = renderEditor({ values: { action: 'grant', targets: [], reason: '' }, errors: {}, rejection: null, shown: { preview: { ...PREVIEW, changed: false, toConfirm: [] }, request: { ...GRANT_REQUEST, targets: [] }, previewed: 'h', stale: false } });
    expect(html).toContain('no hay nada que guardar');
    expect(button(html, 'intent', 'save')).toBe('');
  });

  test('guardar sin cambios avisa que no cambió nada', () => {
    expect(accessSavedNotice(accessSavedNoticeParams({ changed: false }))).toBe('Lo pedido ya era lo que tenía: no cambió nada.');
  });
});

describe('CA-12 · la pantalla de un Personalizado', () => {
  test('⛔ cada regla tiene «Volver a la base» con su objetivo; el catálogo, el nombre visible con el identificador y si ya lo recibe', () => {
    const html = renderEditor();
    expect(button(html, 'reset', 'domain:convert')).toMatch(/>Volver a la base</);
    expect(html).toMatch(/value="domain:convert"[^>]*\/><span class="access-choice__title">Convertir<\/span><code[^>]*>convert<\/code><span class="badge ok">Recibe todas \(9\)<\/span>/);
    expect(html).toMatch(/value="skill:copy"[^>]*\/><span class="access-choice__title">Copy de página<\/span><code[^>]*>copy<\/code><span class="badge ok">La recibe<\/span>/);
    // Sin nombre visible, el identificador una sola vez.
    expect(html).toMatch(/value="skill:page-cro"[^>]*\/><span class="access-choice__title">page-cro<\/span><span class="badge">No la recibe<\/span>/);
  });
});

describe('CA-14 · los rechazos', () => {
  test('⛔ cada código del backend se traduce, con lo que trae', () => {
    const traducir = (body: unknown) => toWriteRejection(body)?.rejection;
    expect(traducir({ codigo: 'no-es-personalizado' })).toEqual({ code: 'not-custom' });
    expect(traducir({ codigo: 'acceso-rechazado', rechazos: ['«nada» no es una skill del catálogo'] })).toEqual({ code: 'access-rejected', rejections: ['«nada» no es una skill del catálogo'] });
    expect(traducir({ codigo: 'falta-confirmar', confirmar: ['vacio'] })).toEqual({ code: 'needs-confirmation' });
    expect(traducir({ codigo: 'conflicto' })).toEqual({ code: 'conflict' });
    expect(traducir({ codigo: 'sin-catalogo', error: 'no está publicada la receta del plan' })).toEqual({ code: 'no-catalog', message: 'no está publicada la receta del plan' });
  });

  test('cada uno se dice en palabras', () => {
    const textos = (['not-custom', 'needs-confirmation', 'conflict'] as const).map((code) => rejectionMessage({ code }));
    expect(textos.every((t) => t.length > 0)).toBe(true);
    expect(rejectionMessage({ code: 'not-custom' })).toContain('pásala primero a Personalizado');
    expect(rejectionMessage({ code: 'no-catalog', message: 'no está publicada la receta del plan' })).toBe('No se puede calcular el acceso: no está publicada la receta del plan.');
  });

  test('⛔ un rechazo vuelve con lo que se mandó y el rechazo, y deja «Ver el cambio» disponible', async () => {
    const rejection: WriteRejection = { code: 'access-rejected', rejections: ['skill:copy: no se puede «dar» y «quitar» en la misma operación'] };
    changeAccess.mockResolvedValue({ kind: 'rejected', rejection, createdAccountId: null });
    const r = (await post([...A_GRANT, ['intent', 'preview']])) as AccessAttempt;
    expect([r.values.targets, r.rejection]).toEqual([['domain:convert', 'skill:copy'], rejection]);
    const html = renderEditor(r);
    expect(html).toContain('Skill:copy: no se puede «dar» y «quitar» en la misma operación.');
    expect(button(html, 'intent', 'preview')).not.toContain('disabled');
    // Lo marcado sigue marcado.
    expect(html).toMatch(/<input type="checkbox"(?=[^>]*value="skill:copy")(?=[^>]*checked="")[^>]*\/>/);
  });

  test('⛔ ante un conflicto pide volver a ver el cambio y no deja «Guardar» a la vista', () => {
    const html = renderEditor({ values: { action: 'grant', targets: ['domain:convert'], reason: '' }, errors: {}, rejection: { code: 'conflict' }, shown: null });
    expect(html).toContain(CONFLICT_MESSAGE);
    expect(button(html, 'intent', 'save')).toBe('');
  });
});
