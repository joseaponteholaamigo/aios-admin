// Claves de la casa (spec «Compartir referentes» de aios-tower, sprint P1; CA-29, CA-30, CA-31, CA-39,
// CA-40 y CA-41).
//
// EL DEFECTO QUE PREVIENE. La clave de ScrapeCreators paga Instagram y TikTok de todas las cuentas: si el
// panel la volviera a pintar después de un rechazo (en el HTML o en lo que la acción devuelve al navegador),
// quedaría en la pantalla, en el historial del navegador o en una captura; si mostrara más que sus últimos 4
// caracteres, la filtraría a medias. Un nombre del backend mal leído diría que hay una clave puesta cuando
// no, o que el proveedor está encendido cuando está apagado. Un rechazo del proveedor leído como «la API no
// respondió» no diría que la clave no sirve. «Quitar la clave» con un solo clic cortaría Instagram y TikTok a
// todos sin motivo. Y la pantalla a la vista de otra persona del equipo le ofrecería algo que el backend le niega.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { HouseKeyChangeRequest } from '../app/domain/house-keys';
import { MODULES, MODULE_LEVELS, type TeamMember } from '../app/domain/permissions';
import { permissionsMiddleware } from '../app/middleware/permissions.server';
import { sessionContext } from '../app/middleware/session.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { toHouseKeyDetail, toHouseKeys } from '../app/shared/api/house-keys-mapping';
import { menuFor } from '../app/shared/routing/route-access';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';
import type { ActiveSession, SessionService } from '../app/shared/session/session.server';
import { readHouseKeyChange, safeValuesOf, type HouseKeyAttempt } from '../app/modules/house-keys/house-key-form-data';
import { houseKeyNotice, keyStateLabel } from '../app/modules/house-keys/house-keys-labels';
import { RemoveKeyDialog } from '../app/modules/house-keys/components/remove-key-dialog';
import { teamMember } from './helpers/fake-admin-api';
import { runMiddleware } from './helpers/run-middleware';

const changeHouseKey = vi.fn();
const getHouseKey = vi.fn();
const listHouseKeys = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeHouseKey }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ getHouseKey, listHouseKeys }) }));
const { action, loader, default: HouseKeyPage } = await import('../app/modules/house-keys/routes/house-key');
const { default: HouseKeysPage } = await import('../app/modules/house-keys/routes/house-keys');

const jose = teamMember('jose', { isSuperadmin: true });
/** Todos los módulos con su nivel más alto, sin ser superadministradora. */
const ana = teamMember('ana', { permissions: Object.fromEntries(MODULES.map((m) => [m, MODULE_LEVELS[m].at(-1)])) as TeamMember['permissions'] });

/** Lo que se pega en el formulario: un marcador de prueba, no una clave real. Termina distinto de la puesta (`a1b2`). */
const PEGADA = 'marcador-de-prueba-no-real-7c3e';

const SC = {
  servicio: 'scrapecreators',
  clave: { puesta: true, ultimos4: 'a1b2', cambio: { el: '2026-11-27T15:42:00.000Z', por: 'ana@beenso.com', motivo: 'Rotación trimestral' } },
  encendido: true,
  saldo: { creditos: 18420 },
};
const HISTORIAL = [
  { el: '2026-11-27T15:42:00.000Z', por: 'ana@beenso.com', accion: 'cambiar', motivo: 'Rotación trimestral' },
  { el: '2026-11-20T23:05:00.000Z', por: 'luis@beenso.com', accion: 'encender', motivo: 'Revisado, era una prueba' },
  { el: '2026-11-20T22:31:00.000Z', por: 'luis@beenso.com', accion: 'apagar', motivo: 'Gasto raro, revisar' },
];
const SIN_CLAVE = {
  ...SC,
  clave: { puesta: false, ultimos4: null, cambio: { el: '2026-11-28T14:12:00.000Z', por: 'ana@beenso.com', motivo: 'La clave se filtró' } },
  encendido: false,
};

const noLog = () => {};

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const sessionOf = (sub: string) => ({ id: `id-${sub}`, sub, tokens: { accessToken: `token-${sub}` }, record: {} }) as unknown as ActiveSession;

function contextOf(member: TeamMember = jose) {
  const context = new RouterContextProvider();
  context.set(sessionContext, sessionOf(member.actor.slice('equipo:'.length)));
  return context;
}

const post = (fields: Record<string, string>, service = 'scrapecreators') =>
  action({ request: new Request(`https://dxxxx.cloudfront.net/house-keys/${service}`, { method: 'POST', body: formOf(fields) }), context: contextOf(), params: { service } } as never);

/** El estado de lo que lanzó una ruta (un `data()` con su `init`), o `null` si no lanzó. */
async function thrownStatus(run: () => Promise<unknown>): Promise<number | null> {
  try {
    await run();
    return null;
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? null;
  }
}

/** Lo que dibuja la pantalla dentro de un router (usa `Form`, `Link` y la consulta de la dirección). */
function render(element: ReturnType<typeof createElement>, at = '/house-keys/scrapecreators') {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

const renderPage = (raw: object, actionData?: HouseKeyAttempt, at?: string) =>
  render(createElement(HouseKeyPage, { loaderData: { detail: toHouseKeyDetail(raw, 'scrapecreators', noLog) }, actionData } as never), at);

/** Un formulario de la pantalla, por su clase, entero. */
const formWithClass = (html: string, className: string) => html.match(new RegExp(`<form\\b[^>]*class="${className}"[^>]*>[\\s\\S]*?</form>`))?.[0] ?? '';
/** La etiqueta entera de un elemento que lleva `attribute`. React ordena los atributos a su modo: se mira la etiqueta entera. */
const tagWith = (html: string, element: string, attribute: string) => html.match(new RegExp(`<${element}\\b[^>]*${attribute}[^>]*>`))?.[0] ?? '';
const submitValues = (html: string) => (html.match(/<button type="submit"[^>]*>/g) ?? []).map((b) => b.match(/value="([^"]+)"/)?.[1]);

beforeEach(() => { changeHouseKey.mockReset(); getHouseKey.mockReset(); listHouseKeys.mockReset(); });

describe('lo que dice el backend', () => {
  // EL DEFECTO: un nombre mal leído diría que hay una clave puesta cuando no, otro final, otra persona o el proveedor encendido cuando está apagado.
  test('⛔ cada servicio, en los nombres del panel', () => {
    expect(toHouseKeys({ servicios: [SC] }, noLog)).toEqual([{
      service: 'scrapecreators', keySet: true, lastFour: 'a1b2',
      lastChange: { changedAt: '2026-11-27T15:42:00.000Z', changedBy: 'ana@beenso.com', reason: 'Rotación trimestral' },
      enabled: true, balance: 18420,
    }]);
  });

  // EL DEFECTO: el historial con otra acción diría que alguien encendió lo que apagó; uno sin tope llenaría la página.
  test('⛔ la página trae el historial traducido, los últimos 20, sea el servicio suelto o dentro de `servicios`', () => {
    const detail = toHouseKeyDetail({ ...SC, historial: HISTORIAL }, 'scrapecreators', noLog);
    expect(detail.history).toEqual([
      { at: '2026-11-27T15:42:00.000Z', by: 'ana@beenso.com', action: 'change', reason: 'Rotación trimestral' },
      { at: '2026-11-20T23:05:00.000Z', by: 'luis@beenso.com', action: 'enable', reason: 'Revisado, era una prueba' },
      { at: '2026-11-20T22:31:00.000Z', by: 'luis@beenso.com', action: 'disable', reason: 'Gasto raro, revisar' },
    ]);
    expect(toHouseKeyDetail({ servicios: [SC], historial: HISTORIAL }, 'scrapecreators', noLog)).toEqual(detail);
    const largo = Array.from({ length: 25 }, () => ({ el: '2026-11-27T15:42:00.000Z', por: 'ana@beenso.com', accion: 'poner', motivo: 'x' }));
    expect(toHouseKeyDetail({ ...SC, historial: largo }, 'scrapecreators', noLog).history).toHaveLength(20);
    // Una acción que el panel no conoce no se esconde: se dice como «otro cambio».
    expect(toHouseKeyDetail({ ...SC, historial: [{ ...HISTORIAL[0], accion: 'rotar' }] }, 'scrapecreators', noLog).history[0]?.action).toBeNull();
  });

  // EL DEFECTO: «Puesta · termina en …» con unos últimos 4 viejos, cuando la clave se cambió por la terminal o ya no hay.
  test('⛔ cambiada fuera del panel, sin clave, y el saldo que `Casa` no pudo leer', () => {
    const [afuera] = toHouseKeys({ servicios: [{ ...SC, clave: { ...SC.clave, ultimos4: null } }] }, noLog);
    const [sinClave] = toHouseKeys({ servicios: [{ ...SC, clave: { ...SC.clave, puesta: false } }] }, noLog);
    const [sinSaldo] = toHouseKeys({ servicios: [{ ...SC, saldo: null }] }, noLog);
    expect([afuera, sinClave].map((s) => s && keyStateLabel(s).text)).toEqual(['Se cambió fuera del panel', 'Sin clave']);
    expect(sinClave?.lastFour).toBeNull();
    expect(sinSaldo?.balance).toBeNull();
    expect(keyStateLabel({ keySet: true, lastFour: 'a1b2' }).text).toBe('Puesta · termina en …a1b2');
  });

  // EL DEFECTO: si el backend mandara más que los últimos 4, la pantalla mostraría media clave (D21).
  test('⛔ nunca más de 4 caracteres, y el log lo avisa sin el valor', () => {
    const logs: string[] = [];
    const [s] = toHouseKeys({ servicios: [{ ...SC, clave: { ...SC.clave, ultimos4: 'medio-secreto-a1b2' } }] }, (m) => logs.push(m));
    expect(s?.lastFour).toBe('a1b2');
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toContain('medio-secreto');
  });

  // EL DEFECTO: un interruptor o una clave sin un sí o un no claros se mostrarían como «apagado» o «sin clave».
  test('⛔ sin un sí o un no en `encendido` o en `puesta`, el contrato se rompe', () => {
    expect(() => toHouseKeys({ servicios: [{ ...SC, encendido: 'true' }] }, noLog)).toThrow(ApiContractError);
    expect(() => toHouseKeys({ servicios: [{ ...SC, clave: { ultimos4: 'a1b2' } }] }, noLog)).toThrow(ApiContractError);
    expect(() => toHouseKeyDetail({ ...SC, servicio: 'fullenrich' }, 'scrapecreators', noLog)).toThrow(ApiContractError);
  });

  // EL DEFECTO: un servicio que el backend sume antes que el panel rompería la lista entera.
  test('un servicio que el panel no conoce se ignora y queda en el log', () => {
    const logs: string[] = [];
    expect(toHouseKeys({ servicios: [SC, { ...SC, servicio: 'fullenrich' }] }, (m) => logs.push(m)).map((s) => s.service)).toEqual(['scrapecreators']);
    expect(logs.join('\n')).toContain('fullenrich');
  });
});

describe('el pedido al backend', () => {
  type Seen = { method: string; url: string; body: unknown };
  function apiAnswering(respond: () => Response) {
    const seen: Seen[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ method: init?.method ?? 'GET', url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return respond();
    }) as typeof fetch;
    return {
      write: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: noLog }),
      read: createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl, log: noLog }),
      seen,
    };
  }

  // EL DEFECTO: leer en otra ruta o con otro método, y la página no cargaría nunca.
  test('⛔ la lista es un GET a /v1/admin/casa, y la página, a /v1/admin/casa/scrapecreators', async () => {
    const api = apiAnswering(() => Response.json({ servicios: [SC], historial: HISTORIAL }));
    expect((await api.read.listHouseKeys('t')).kind).toBe('ok');
    expect((await api.read.getHouseKey('t', 'scrapecreators')).kind).toBe('ok');
    expect(api.seen).toEqual([
      { method: 'GET', url: 'https://api.example/v1/admin/casa', body: null },
      { method: 'GET', url: 'https://api.example/v1/admin/casa/scrapecreators', body: null },
    ]);
  });

  // EL DEFECTO: con otros nombres el backend lo rechazaría siempre; la clave en la ruta quedaría en los logs de acceso.
  test('⛔ cada cambio es un PUT con los nombres del backend; la clave va solo en el cuerpo', async () => {
    const { write, seen } = apiAnswering(() => Response.json(SC));
    const cambios: HouseKeyChangeRequest[] = [
      { action: 'key', key: PEGADA, reason: 'Rotación trimestral', enable: true },
      { action: 'remove', reason: 'La clave se filtró' },
      { action: 'switch', enabled: false, reason: 'Gasto raro, revisar' },
    ];
    for (const change of cambios) expect(await write.changeHouseKey('t', 'scrapecreators', change)).toEqual({ kind: 'ok', value: null });
    const url = 'https://api.example/v1/admin/casa/scrapecreators';
    expect(seen).toEqual([
      { method: 'PUT', url, body: { accion: 'clave', clave: PEGADA, motivo: 'Rotación trimestral', encender: true } },
      { method: 'PUT', url, body: { accion: 'quitar', motivo: 'La clave se filtró' } },
      { method: 'PUT', url, body: { accion: 'interruptor', encendido: false, motivo: 'Gasto raro, revisar' } },
    ]);
  });

  // EL DEFECTO: leído como «la API no respondió», el rechazo del proveedor no diría que la clave no sirve; leído
  // como sesión vencida, cerraría la sesión.
  test('⛔ una clave rechazada y un servicio desconocido vuelven al formulario; el 403 es «sin permiso»', async () => {
    const cambio: HouseKeyChangeRequest = { action: 'key', key: PEGADA, reason: 'x', enable: false };
    const rechazada = await apiAnswering(() => Response.json({ codigo: 'clave-rechazada' }, { status: 422 })).write.changeHouseKey('t', 'scrapecreators', cambio);
    const desconocido = await apiAnswering(() => Response.json({ codigo: 'servicio-desconocido' }, { status: 404 })).write.changeHouseKey('t', 'scrapecreators', cambio);
    const ajeno = await apiAnswering(() => Response.json({ error: 'esto lo hace solo un superadministrador' }, { status: 403 })).write.changeHouseKey('t', 'scrapecreators', cambio);
    expect([rechazada, desconocido, ajeno]).toEqual([
      { kind: 'rejected', rejection: { code: 'key-rejected' }, createdAccountId: null },
      { kind: 'rejected', rejection: { code: 'unknown-service' }, createdAccountId: null },
      { kind: 'forbidden' },
    ]);
    expect(await apiAnswering(() => Response.json({ error: 'no' }, { status: 403 })).read.getHouseKey('t', 'scrapecreators')).toEqual({ kind: 'forbidden' });
  });
});

describe('los formularios', () => {
  // EL DEFECTO: un cambio sin motivo no deja rastro de por qué; una clave con espacios pegados cortaría ScrapeCreators a todos.
  test('⛔ poner o cambiar la clave pide la clave y el motivo; la clave se recorta y no lleva espacios', () => {
    expect(readHouseKeyChange(formOf({ intent: 'key', key: `  ${PEGADA}\n`, reason: ' Rotación trimestral ', enable: 'on' })))
      .toEqual({ intent: 'key', change: { action: 'key', key: PEGADA, reason: 'Rotación trimestral', enable: true } });
    expect(readHouseKeyChange(formOf({ intent: 'key', key: PEGADA, reason: 'x' })))
      .toEqual({ intent: 'key', change: { action: 'key', key: PEGADA, reason: 'x', enable: false } });
    const vacio = readHouseKeyChange(formOf({ intent: 'key', key: '   ', reason: '  ' }));
    expect('errors' in vacio && Object.keys(vacio.errors).sort()).toEqual(['key', 'reason']);
    const conEspacios = readHouseKeyChange(formOf({ intent: 'key', key: 'parte-uno parte-secreta', reason: 'x' }));
    expect('errors' in conEspacios && Object.keys(conEspacios.errors)).toEqual(['key']);
    // El mensaje nunca repite lo pegado.
    expect(JSON.stringify(conEspacios)).not.toContain('parte-secreta');
  });

  // EL DEFECTO: quitar o mover el interruptor sin motivo; un interruptor que «cambia» en vez de pedir un estado
  // apagaría lo que otro acaba de apagar… encendiéndolo.
  test('⛔ quitar y el interruptor piden motivo; el interruptor manda el estado que se quiere', () => {
    expect(readHouseKeyChange(formOf({ intent: 'remove', reason: 'La clave se filtró', key: PEGADA })))
      .toEqual({ intent: 'remove', change: { action: 'remove', reason: 'La clave se filtró' } });
    expect(readHouseKeyChange(formOf({ intent: 'switch', enabled: 'false', reason: 'Gasto raro' })))
      .toEqual({ intent: 'switch', change: { action: 'switch', enabled: false, reason: 'Gasto raro' } });
    const sinMotivo: Record<string, string>[] = [{ intent: 'remove', reason: '' }, { intent: 'switch', enabled: 'true', reason: ' ' }];
    for (const fields of sinMotivo) {
      const r = readHouseKeyChange(formOf(fields));
      expect('errors' in r && Object.keys(r.errors), fields.intent).toEqual(['reason']);
    }
    const raro = readHouseKeyChange(formOf({ intent: 'switch', enabled: 'tal-vez', reason: 'x' }));
    expect('errors' in raro && Object.keys(raro.errors)).toEqual(['enabled']);
  });

  // EL DEFECTO: lo que se guarda para volver a llenar el formulario viaja al navegador.
  test('⛔ lo que se vuelve a pintar es el motivo y la casilla, nunca la clave', () => {
    expect(safeValuesOf(formOf({ intent: 'key', key: PEGADA, reason: 'Rotación', enable: 'on' }))).toEqual({ reason: 'Rotación', enable: 'on' });
  });

  // EL DEFECTO: un pedido de otra pantalla, o armado a mano, se leería como uno de estos formularios.
  test('un pedido que no es de ningún formulario de la página no se lee', () => {
    expect(readHouseKeyChange(formOf({ intent: 'borrar', reason: 'x' }))).toEqual({ intent: null });
  });
});

describe('la acción', () => {
  // EL DEFECTO: lo que devuelve la acción viaja al navegador como datos de la página: con la clave adentro, quedaría
  // en la memoria de la página y en cualquier captura de la red.
  test('⛔ después de un rechazo, lo que vuelve a la página no trae la clave', async () => {
    changeHouseKey.mockResolvedValue({ kind: 'rejected', rejection: { code: 'key-rejected' }, createdAccountId: null });
    const r = (await post({ intent: 'key', key: PEGADA, reason: 'Rotación trimestral', enable: 'on' })) as HouseKeyAttempt;
    expect(changeHouseKey).toHaveBeenCalledWith('token-jose', 'scrapecreators', { action: 'key', key: PEGADA, reason: 'Rotación trimestral', enable: true });
    expect(r).toEqual({ intent: 'key', values: { reason: 'Rotación trimestral', enable: 'on' }, errors: {}, rejection: { code: 'key-rejected' } });
    expect(JSON.stringify(r)).not.toContain('7c3e');
  });

  // EL DEFECTO: el equipo no sabría que el cambio quedó; con la clave en la dirección, quedaría en el historial del navegador.
  test('⛔ un cambio que salió bien vuelve a la página con el aviso, sin la clave en la dirección', async () => {
    changeHouseKey.mockResolvedValue({ kind: 'ok', value: null });
    const r = (await post({ intent: 'key', key: PEGADA, reason: 'Rotación trimestral' })) as Response;
    expect(r.headers.get('Location')).toBe('/house-keys/scrapecreators?aviso=clave');
    const quitada = (await post({ intent: 'remove', reason: 'La clave se filtró' })) as Response;
    const apagado = (await post({ intent: 'switch', enabled: 'false', reason: 'Gasto raro' })) as Response;
    expect([quitada, apagado].map((x) => x.headers.get('Location')))
      .toEqual(['/house-keys/scrapecreators?aviso=quitada', '/house-keys/scrapecreators?aviso=apagado']);
  });

  // EL DEFECTO: un formulario que el panel ya sabe inválido iría igual al backend.
  test('un formulario inválido no llama al backend', async () => {
    const r = (await post({ intent: 'key', key: PEGADA, reason: '' })) as HouseKeyAttempt;
    expect([Object.keys(r.errors), changeHouseKey.mock.calls.length, JSON.stringify(r).includes('7c3e')]).toEqual([['reason'], 0, false]);
  });

  // EL DEFECTO: la página de un servicio que el panel no administra le preguntaría al backend, o mandaría un cambio a otra clave.
  test('⛔ un servicio que no es de la lista responde 404 sin llamar al backend', async () => {
    const pedido = new Request('https://dxxxx.cloudfront.net/house-keys/fullenrich');
    expect(await thrownStatus(() => loader({ request: pedido, context: contextOf(), params: { service: 'fullenrich' } } as never))).toBe(404);
    expect(await thrownStatus(() => post({ intent: 'remove', reason: 'x' }, 'fullenrich'))).toBe(404);
    expect([getHouseKey.mock.calls.length, changeHouseKey.mock.calls.length]).toEqual([0, 0]);
  });
});

describe('quién la ve', () => {
  // EL DEFECTO: la pantalla se le ofrecería a quien el backend le responde 403 (D15, CA-29).
  test('⛔ solo el superadministrador: las dos rutas lo exigen y el menú no se la muestra a nadie más, aunque tenga todos los módulos', () => {
    expect(ROUTE_TABLE.filter((r) => r.path.startsWith('house-keys')).map((r) => [r.path, r.access]))
      .toEqual([['house-keys', 'superadmin'], ['house-keys/:service', 'superadmin']]);
    expect(menuFor(ana).some((item) => item.path.startsWith('/house-keys'))).toBe(false);
    expect(menuFor(jose).filter((item) => item.path.startsWith('/house-keys')))
      .toEqual([{ path: '/house-keys', label: 'Claves de la casa', group: 'business', icon: 'key' }]);
  });

  // EL DEFECTO: esconder el menú no protege: sin el 403 de la ruta, la pantalla cargaría con la dirección escrita a mano.
  test('⛔ a otra persona del equipo, la lista y la página responden 403 sin cargar', async () => {
    const sessions = { destroy: async () => ({ cookie: '', session: null }) } as unknown as SessionService;
    const pedir = async (member: TeamMember, path: string) => {
      const middleware = permissionsMiddleware({ members: () => ({ load: async () => ({ kind: 'member', member }) }), sessions: () => sessions, log: noLog });
      return runMiddleware(middleware, path, contextOf(member));
    };
    for (const path of ['/house-keys', '/house-keys/scrapecreators']) {
      const deAna = await pedir(ana, path);
      expect([deAna.reached, deAna.thrownStatus], path).toEqual([false, 403]);
      expect((await pedir(jose, path)).reached, path).toBe(true);
    }
  });
});

describe('en pantalla', () => {
  // EL DEFECTO: la lista con otra fila, o sin decir en qué termina la clave, el saldo y si está encendido (CA-29, CA-41).
  test('⛔ la lista tiene una sola fila, ScrapeCreators, con la clave, el saldo y el interruptor', () => {
    const html = render(createElement(HouseKeysPage, { loaderData: { services: toHouseKeys({ servicios: [SC] }, noLog) } } as never), '/house-keys');
    expect(html.match(/<tr class="linked-row"/g)).toHaveLength(1);
    for (const text of ['ScrapeCreators', 'Puesta · termina en …a1b2', '18.420 créditos', 'Encendido', 'href="/house-keys/scrapecreators"']) expect(html, text).toContain(text);
  });

  // EL DEFECTO: el superadmin no sabría qué clave está puesta, quién la cambió, cuánto saldo queda, ni quién movió el interruptor (CA-29).
  test('⛔ la página dice el estado, el último cambio, el saldo, el interruptor y el historial', () => {
    const html = renderPage({ ...SC, historial: HISTORIAL });
    for (const text of [
      'Puesta · termina en …a1b2', 'ana@beenso.com, el 27 nov 2026, 10:42', '18.420 créditos de ScrapeCreators', 'Encendido',
      'Apagar ScrapeCreators', 'Cambiar la clave', 'Cambió la clave', 'Encendió ScrapeCreators', 'Apagó ScrapeCreators', 'Gasto raro, revisar',
    ]) expect(html, text).toContain(text);
  });

  // EL DEFECTO: unos últimos 4 viejos cuando la clave se cambió por la terminal; un saldo de 0 cuando no se pudo leer.
  test('⛔ cambiada fuera del panel, sin clave y sin saldo, cada una se dice', () => {
    const afuera = renderPage({ ...SC, clave: { ...SC.clave, ultimos4: null, cambio: { el: '2026-11-27T15:42:00.000Z', por: null, motivo: null } }, saldo: null });
    for (const text of ['Se cambió fuera del panel', 'Fuera del panel, el 27 nov 2026, 10:42', 'No se pudo leer']) expect(afuera, text).toContain(text);
    expect(afuera).not.toContain('termina en');
    const sinClave = renderPage(SIN_CLAVE);
    for (const text of ['Sin clave', 'Apagado', 'Poner una clave', 'Encender ScrapeCreators']) expect(sinClave, text).toContain(text);
    expect(sinClave).not.toContain('Quitar la clave');
  });

  // EL DEFECTO: un campo de texto mostraría la clave a quien mire la pantalla, y el navegador la guardaría o la ofrecería en otro campo (CA-31).
  test('⛔ el campo de la clave es de contraseña, sin autocompletar, sin valor y sin «mostrar»', () => {
    const html = renderPage(SC);
    const campo = tagWith(html, 'input', 'name="key"');
    expect([campo.includes('type="password"'), campo.includes('autoComplete="off"') || campo.includes('autocomplete="off"'), campo.includes('value=')]).toEqual([true, true, false]);
    // Ningún botón la muestra, y el campo de la clave es el único que la recibe.
    expect(html).not.toMatch(/<button\b[^>]*>[^<]*mostrar/i);
    expect(html.match(/name="key"/g)).toHaveLength(1);
    expect(tagWith(html, 'form', 'class="key-form"')).toMatch(/autocomplete="off"/i);
  });

  // EL DEFECTO: después de un rechazo, la clave seguiría en el HTML o en el campo, y el superadmin no sabría que no se cambió nada (CA-30, CA-31).
  test('⛔ después de un rechazo, el formulario no vuelve a pintar la clave y dice que el proveedor la rechazó', async () => {
    changeHouseKey.mockResolvedValue({ kind: 'rejected', rejection: { code: 'key-rejected' }, createdAccountId: null });
    const attempt = (await post({ intent: 'key', key: PEGADA, reason: 'Rotación trimestral' })) as HouseKeyAttempt;
    const html = renderPage(SC, attempt);
    expect(html).not.toContain('7c3e');
    expect(tagWith(html, 'input', 'name="key"')).not.toContain('value=');
    const form = formWithClass(html, 'key-form');
    expect([form.includes('ScrapeCreators rechazó esa clave. No se cambió nada.'), tagWith(form, 'input', 'name="reason"').includes('value="Rotación trimestral"')]).toEqual([true, true]);
    // El rechazo se lee solo en su formulario.
    expect(html.split('rechazó esa clave').length - 1).toBe(1);
  });

  // EL DEFECTO: un clic suelto en «Quitar la clave» cortaría Instagram y TikTok a todos, sin confirmación ni motivo (CA-39).
  test('⛔ «Quitar la clave» pide confirmación: abre un diálogo que pide el motivo y dice qué se corta', () => {
    const html = renderPage(SC);
    expect(html).toMatch(/<button type="button"[^>]*>Quitar la clave<\/button>/);
    expect(submitValues(html)).toEqual(['switch', 'key']);
    const dialogo = render(createElement(RemoveKeyDialog, { service: 'scrapecreators', attempt: null, onClose: () => {} }));
    expect(dialogo).toContain('¿Quitar la clave de ScrapeCreators?');
    expect(dialogo).toContain('Instagram y TikTok en ENSŌ se cortan para todas las cuentas al instante');
    expect(dialogo).toContain('revócala también en su panel');
    expect(tagWith(dialogo, 'input', 'name="reason"')).toContain('required=""');
    expect(submitValues(dialogo)).toEqual(['remove']);
    expect(dialogo).toMatch(/<form[^>]*action="\/house-keys\/scrapecreators"/);
  });

  // EL DEFECTO: si el diálogo no se reabriera con el rechazo, la página se vería como si nada y la clave seguiría puesta.
  test('⛔ un rechazo al quitar reabre la confirmación, con el rechazo y el motivo escrito', () => {
    const html = renderPage(SC, { intent: 'remove', values: { reason: 'La clave se filtró' }, errors: {}, rejection: { code: 'conflict' } });
    const dialogo = html.match(/<dialog\b[\s\S]*?<\/dialog>/)?.[0] ?? '';
    expect(dialogo).toContain('¿Quitar la clave de ScrapeCreators?');
    expect([dialogo.includes('Otro cambio llegó primero'), tagWith(dialogo, 'input', 'name="reason"').includes('value="La clave se filtró"')]).toEqual([true, true]);
    expect(html.split('Otro cambio llegó primero').length - 1).toBe(1);
  });

  // EL DEFECTO: con la clave quitada, poner una nueva dejaría ScrapeCreators apagado sin que nadie lo note; con el
  // proveedor encendido, la casilla no hace nada y confunde (CA-40).
  test('⛔ «Poner una clave» trae «Encender ScrapeCreators al guardar» marcada; encendido, no hay casilla', () => {
    const casilla = (html: string) => tagWith(html, 'input', 'name="enable"');
    expect(casilla(renderPage(SIN_CLAVE))).toContain('checked=""');
    expect(renderPage(SIN_CLAVE)).toContain('Encender ScrapeCreators al guardar');
    // Con clave pero apagado (alguien lo apagó a propósito), cambiar la clave no lo enciende solo.
    const apagado = casilla(renderPage({ ...SC, encendido: false }));
    expect([apagado !== '', apagado.includes('checked')]).toEqual([true, false]);
    expect(casilla(renderPage(SC))).toBe('');
  });

  // EL DEFECTO: después de quitarla, nadie recordaría que la clave sigue viva en ScrapeCreators hasta revocarla allá (CA-39).
  test('⛔ al quitarla, la página dice «Sin clave» y el aviso de revocarla en ScrapeCreators', () => {
    const html = renderPage(SIN_CLAVE, undefined, '/house-keys/scrapecreators?aviso=quitada');
    expect(html).toContain('Sin clave');
    expect(html).toContain('Revócala también en el panel de ScrapeCreators');
    // Un aviso armado a mano no sale.
    expect(houseKeyNotice(new URLSearchParams('aviso=%3Cscript%3E'), toHouseKeyDetail(SC, 'scrapecreators', noLog))).toBeNull();
  });
});
