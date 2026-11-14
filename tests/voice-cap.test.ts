// La pantalla del tope de la voz (spec «Registro abierto» de aios-tower, CA-33; tarea RP2 del panel).
//
// EL DEFECTO QUE PREVIENE. Un nombre del backend mal leído mostraría un tope que no rige (el de por
// omisión como si alguien lo hubiera fijado) o callaría que el filtro deja cuentas afuera; un cambio que
// viajara con otros nombres, con el tope como texto o sin `topeUsd: null` al quitar una excepción, lo
// rechazaría el backend siempre; la cuenta en la dirección quedaría en los logs de acceso; el rechazo
// del MFA leído como sesión vencida cerraría la sesión en vez de pedir el código; un rechazo pintado en
// el otro formulario de la pantalla no diría qué corregir; y la pantalla a la vista de otra persona del
// equipo le ofrecería algo que el backend le niega.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MODULES, MODULE_LEVELS, type TeamMember } from '../app/domain/permissions';
import type { VoiceCapChange, VoiceCapException } from '../app/domain/voice-cap';
import { permissionsMiddleware } from '../app/middleware/permissions.server';
import { sessionContext } from '../app/middleware/session.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { toVoiceCaps } from '../app/shared/api/voice-cap-mapping';
import { menuFor } from '../app/shared/routing/route-access';
import { ROUTE_TABLE } from '../app/shared/routing/route-table';
import type { ActiveSession, SessionService } from '../app/shared/session/session.server';
import { readVoiceCapChange, type VoiceAttempt } from '../app/modules/voice/voice-form-data';
import { WHEN_IT_APPLIES, dollarsLabel, voiceCapNotice, voiceCapNoticeParams } from '../app/modules/voice/voice-labels';
import { CapExceptionsTable } from '../app/modules/voice/components/cap-exceptions-table';
import { RemoveExceptionDialog } from '../app/modules/voice/components/remove-exception-dialog';
import { teamMember } from './helpers/fake-admin-api';
import { runMiddleware } from './helpers/run-middleware';

const changeVoiceCap = vi.fn();
const getVoiceCaps = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeVoiceCap }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ getVoiceCaps }) }));
const { action, default: VoicePage } = await import('../app/modules/voice/routes/voice');

const jose = teamMember('jose', { isSuperadmin: true });
/** Todos los módulos con su nivel más alto, sin ser superadministradora. */
const ana = teamMember('ana', { permissions: Object.fromEntries(MODULES.map((m) => [m, MODULE_LEVELS[m].at(-1)])) as TeamMember['permissions'] });

const CRUDO = {
  general: { topeUsd: 8, porOmision: false, cambiadoPor: 'equipo:sub-jose', cambiadoEl: '2026-11-12T15:00:00.000Z' },
  maximoUsd: 20,
  excepciones: [{ tenantId: 'auteco-4d5e6f', nombre: 'Auteco', topeUsd: 15, cambiadoPor: 'equipo:sub-jose', cambiadoEl: '2026-11-12T16:00:00.000Z' }],
  soloAlgunas: false,
};
const POR_OMISION = { topeUsd: 10, porOmision: true, cambiadoPor: null, cambiadoEl: null };
const AUTECO: VoiceCapException = { accountId: 'auteco-4d5e6f', accountName: 'Auteco', usd: 15, changedBy: 'equipo:sub-jose', changedAt: '2026-11-12T16:00:00.000Z' };

const GENERAL: VoiceCapChange = { target: 'general', usd: 8, reason: 'medido el primer mes' };
const PONER: VoiceCapChange = { target: 'account', accountId: 'auteco-4d5e6f', usd: 15, reason: 'contrato' };
const QUITAR: VoiceCapChange = { target: 'account', accountId: 'auteco-4d5e6f', usd: null, reason: 'terminó el contrato' };

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

const post = (fields: Record<string, string>) =>
  action({ request: new Request('https://dxxxx.cloudfront.net/voice', { method: 'POST', body: formOf(fields) }), context: contextOf(), params: {} } as never);

/** Lo que dibuja un componente de la pantalla, dentro de un router (usa `Form` y `Link`), en `/voice`. */
function render(element: ReturnType<typeof createElement>) {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/voice'] }));
}

const renderPage = (raw: object, actionData?: VoiceAttempt) =>
  render(createElement(VoicePage, { loaderData: { caps: toVoiceCaps(raw) }, actionData } as never));

/** Un formulario de la pantalla, por su clase, entero. */
const formWithClass = (html: string, className: string) => html.match(new RegExp(`<form\\b[^>]*${className}[^>]*>[\\s\\S]*?</form>`))?.[0] ?? '';
/** Un campo de la pantalla, por el `id` de su entrada: su etiqueta, la entrada, la ayuda y el error. */
const fieldOf = (html: string, id: string) => html.match(new RegExp(`<div class="field"><label for="${id}">[\\s\\S]*?</div>`))?.[0] ?? '';
/** La etiqueta entera de un elemento que lleva `attribute`. React ordena los atributos a su modo: se mira la etiqueta entera. */
const tagWith = (html: string, element: string, attribute: string) => html.match(new RegExp(`<${element}\\b[^>]*${attribute}[^>]*>`))?.[0] ?? '';

beforeEach(() => { changeVoiceCap.mockReset(); getVoiceCaps.mockReset(); });

describe('lo que dice el backend', () => {
  // EL DEFECTO: un nombre mal leído mostraría otro tope, otra cuenta, o a otra persona como quien lo cambió.
  test('⛔ el general, el máximo y cada excepción, en los nombres del panel', () => {
    expect(toVoiceCaps(CRUDO)).toEqual({
      general: { usd: 8, isDefault: false, changedBy: 'equipo:sub-jose', changedAt: '2026-11-12T15:00:00.000Z' },
      maxUsd: 20,
      exceptions: [AUTECO],
      onlySome: false,
    });
  });

  // EL DEFECTO: sin fila del general rige US$10; si el panel no lo dijera, parecería que alguien lo fijó.
  test('⛔ el tope de por omisión se lee como tal', () => {
    const caps = toVoiceCaps({ ...CRUDO, general: POR_OMISION, excepciones: [] });
    expect([caps.general.usd, caps.general.isDefault, caps.exceptions]).toEqual([10, true, []]);
  });

  // EL DEFECTO: un tope que llega torcido se mostraría como 0 («la voz no tiene tope»), y sin el dato del
  // filtro el superadmin creería que no hay más excepciones que las que ve.
  test('⛔ un tope que no es un número rompe el contrato; sin `soloAlgunas`, se avisa del filtro', () => {
    expect(() => toVoiceCaps({ ...CRUDO, general: { ...CRUDO.general, topeUsd: '8' } })).toThrow(ApiContractError);
    expect(() => toVoiceCaps({ ...CRUDO, maximoUsd: undefined })).toThrow(ApiContractError);
    const sinDato: Record<string, unknown> = { ...CRUDO };
    delete sinDato.soloAlgunas;
    expect(toVoiceCaps(sinDato).onlySome).toBe(true);
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
      write: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }),
      read: createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }),
      seen,
    };
  }

  // EL DEFECTO: con otro método, otros nombres, el tope como texto o sin `topeUsd: null` al quitar, el
  // backend lo rechazaría siempre; y la cuenta en la dirección quedaría en los logs de acceso.
  test('⛔ un cambio es un PUT a /v1/admin/voz: la cuenta en el cuerpo, el tope como número, y `null` al quitar', async () => {
    const { write, seen } = apiAnswering(() => Response.json({ general: { antes: 10, despues: 8 } }));
    for (const change of [GENERAL, PONER, QUITAR]) await write.changeVoiceCap('t', change);
    expect(seen).toEqual([
      { method: 'PUT', url: 'https://api.example/v1/admin/voz', body: { topeUsd: 8, motivo: 'medido el primer mes' } },
      { method: 'PUT', url: 'https://api.example/v1/admin/voz', body: { tenantId: 'auteco-4d5e6f', topeUsd: 15, motivo: 'contrato' } },
      { method: 'PUT', url: 'https://api.example/v1/admin/voz', body: { tenantId: 'auteco-4d5e6f', topeUsd: null, motivo: 'terminó el contrato' } },
    ]);
  });

  // EL DEFECTO: el aviso diría un antes y un después que no son los que guardó el backend.
  test('lee el antes y el después de las dos formas de respuesta', async () => {
    const general = await apiAnswering(() => Response.json({ general: { antes: 10, despues: 8 } })).write.changeVoiceCap('t', GENERAL);
    const cuenta = await apiAnswering(() => Response.json({ tenantId: 'auteco-4d5e6f', topeUsd: { antes: 15, despues: null } })).write.changeVoiceCap('t', QUITAR);
    expect([general, cuenta]).toEqual([{ kind: 'ok', value: { before: 10, after: 8 } }, { kind: 'ok', value: { before: 15, after: null } }]);
  });

  // EL DEFECTO: leído como sesión vencida o como «la API no responde», el MFA vencido cerraría la sesión o
  // mostraría una página de error en vez de pedir el código; un conflicto o una cuenta que no existe no dirían qué pasó.
  test('⛔ cada rechazo vuelve al formulario: el MFA vencido pide el código, no cierra la sesión', async () => {
    const casos: [number, object, object][] = [
      [401, { codigo: 'mfa-reciente' }, { code: 'recent-mfa' }],
      [409, { codigo: 'conflicto', error: 'otro cambio del tope de la voz llegó primero' }, { code: 'conflict' }],
      [404, { codigo: 'no-existe', error: 'esa cuenta no existe' }, { code: 'not-found' }],
      [422, { codigo: 'invalido', error: 'el tope de la voz es un número de dólares' }, { code: 'invalid', message: 'el tope de la voz es un número de dólares', field: null }],
    ];
    for (const [status, body, rejection] of casos) {
      const r = await apiAnswering(() => Response.json(body, { status })).write.changeVoiceCap('t', GENERAL);
      expect(r, JSON.stringify(body)).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });

  // EL DEFECTO: leer la pantalla con otro método o en otra ruta, o tomar el 403 de otra persona del equipo por un dato.
  test('la lectura es un GET a /v1/admin/voz; el 403 del backend es «sin permiso»', async () => {
    const ok = apiAnswering(() => Response.json(CRUDO));
    expect((await ok.read.getVoiceCaps('t')).kind).toBe('ok');
    expect(ok.seen).toEqual([{ method: 'GET', url: 'https://api.example/v1/admin/voz', body: null }]);
    expect(await apiAnswering(() => Response.json({ error: 'esto lo hace solo un superadministrador' }, { status: 403 })).read.getVoiceCaps('t')).toEqual({ kind: 'forbidden' });
    expect(await apiAnswering(() => Response.json({ error: 'no' }, { status: 403 })).write.changeVoiceCap('t', GENERAL)).toEqual({ kind: 'forbidden' });
  });
});

describe('los formularios', () => {
  // EL DEFECTO: un tope de 0 cortaría la voz a todos; uno con tres decimales o escrito con coma
  // llegaría torcido; un cambio sin motivo lo rechaza el backend y queda sin rastro de por qué.
  test('⛔ el tope general: dólares mayores que 0 con hasta dos decimales, con coma o con punto, y con motivo', () => {
    expect(readVoiceCapChange(formOf({ intent: 'general', usd: ' 7,5 ', reason: ' medido el primer mes ' })))
      .toEqual({ intent: 'general', change: { target: 'general', usd: 7.5, reason: 'medido el primer mes' } });
    for (const usd of ['0', '0.00', '-1', 'ocho', '7.505', '']) {
      const r = readVoiceCapChange(formOf({ intent: 'general', usd, reason: 'x' }));
      expect('errors' in r && Object.keys(r.errors), usd).toEqual(['usd']);
    }
    const sinMotivo = readVoiceCapChange(formOf({ intent: 'general', usd: '8', reason: '   ' }));
    expect('errors' in sinMotivo && Object.keys(sinMotivo.errors)).toEqual(['reason']);
  });

  // EL DEFECTO: el backend acepta el id en minúsculas; uno escrito con mayúsculas o espacios le
  // respondería «no existe» a una cuenta que sí existe, y uno que no puede ser un id no tiene a quién ir.
  test('⛔ la excepción: el id de la cuenta se normaliza como en Empresas; uno que no puede ser un id no viaja', () => {
    expect(readVoiceCapChange(formOf({ intent: 'exception', accountId: ' Auteco-4D5E6F ', usd: '15', reason: 'contrato' })))
      .toEqual({ intent: 'exception', change: PONER });
    const malo = readVoiceCapChange(formOf({ intent: 'exception', accountId: 'con espacios', usd: '15', reason: 'contrato' }));
    expect('errors' in malo && Object.keys(malo.errors)).toEqual(['accountId']);
  });

  // EL DEFECTO: si quitar llevara el tope que quedó en el formulario, pondría la excepción en vez de quitarla.
  test('⛔ quitar la excepción no lleva tope: viaja `null`, con la cuenta y el motivo', () => {
    expect(readVoiceCapChange(formOf({ intent: 'remove-exception', accountId: 'auteco-4d5e6f', reason: 'terminó el contrato', usd: '15' })))
      .toEqual({ intent: 'remove-exception', change: QUITAR });
    const sinMotivo = readVoiceCapChange(formOf({ intent: 'remove-exception', accountId: 'auteco-4d5e6f', reason: '' }));
    expect('errors' in sinMotivo && Object.keys(sinMotivo.errors)).toEqual(['reason']);
  });

  // EL DEFECTO: un pedido de otra pantalla, o armado a mano, se leería como uno de estos formularios.
  test('un pedido que no es de ningún formulario de la pantalla no se lee', () => {
    expect(readVoiceCapChange(formOf({ intent: 'borrar', usd: '8', reason: 'x' }))).toEqual({ intent: null });
  });
});

describe('la acción', () => {
  // EL DEFECTO: el equipo no sabría que el cambio quedó, ni que las llaves vivas tardan hasta el barrido en usarlo.
  test('⛔ un cambio que salió bien vuelve a la pantalla con el aviso del antes, el después y cuándo vale', async () => {
    changeVoiceCap.mockResolvedValue({ kind: 'ok', value: { before: 10, after: 8 } });
    const r = (await post({ intent: 'general', usd: '8', reason: 'medido el primer mes' })) as Response;
    expect(changeVoiceCap).toHaveBeenCalledWith('token-jose', GENERAL);
    expect(r.headers.get('Location')).toBe('/voice?aviso=tope-general&antes=10&despues=8');
    expect(voiceCapNotice(new URLSearchParams('aviso=tope-general&antes=10&despues=8'))).toBe(`Tope general cambiado de US$10 a US$8. ${WHEN_IT_APPLIES}`);
  });

  // EL DEFECTO: con el MFA vencido se perdería lo escrito, o el rechazo iría a otro formulario.
  test('⛔ un rechazo vuelve al formulario que lo mandó, con lo escrito', async () => {
    changeVoiceCap.mockResolvedValue({ kind: 'rejected', rejection: { code: 'recent-mfa' }, createdAccountId: null });
    const r = (await post({ intent: 'exception', accountId: 'auteco-4d5e6f', usd: '15', reason: 'contrato' })) as VoiceAttempt;
    expect([r.intent, r.values.accountId, r.values.usd, r.rejection]).toEqual(['exception', 'auteco-4d5e6f', '15', { code: 'recent-mfa' }]);
  });

  // EL DEFECTO: un formulario que el panel ya sabe inválido iría igual al backend.
  test('un formulario inválido no llama al backend', async () => {
    const r = (await post({ intent: 'general', usd: '0', reason: '' })) as VoiceAttempt;
    expect([Object.keys(r.errors).sort(), changeVoiceCap.mock.calls.length]).toEqual([['reason', 'usd'], 0]);
  });
});

describe('el aviso', () => {
  // EL DEFECTO: el aviso inventaría un cambio que no hubo, o mostraría lo que diga una dirección armada a mano.
  test('dice la cuenta, el antes, el después y cuándo vale; uno que no cambió nada lo dice; uno armado a mano no sale', () => {
    const aviso = (q: string) => voiceCapNotice(new URLSearchParams(q));
    expect(aviso(voiceCapNoticeParams(PONER, { before: null, after: 15 }))).toBe(`La cuenta auteco-4d5e6f queda con un tope de US$15 (en lugar del general). ${WHEN_IT_APPLIES}`);
    expect(aviso(voiceCapNoticeParams(QUITAR, { before: 15, after: null }))).toBe(`La cuenta auteco-4d5e6f ya no tiene excepción: vuelve al tope general. ${WHEN_IT_APPLIES}`);
    expect(aviso(voiceCapNoticeParams(GENERAL, { before: 8, after: 8 }))).toBe('El tope general ya era US$8: no cambió nada.');
    expect([aviso('aviso=excepcion&cuenta=%3Cscript%3E&antes=&despues=15'), aviso('aviso=tope-general&antes=diez&despues=8')]).toEqual([null, null]);
  });

  // EL DEFECTO: «US$7.5» o «US$7,5» se leen mal, y «US$10,00» es ruido.
  test('los dólares van con centavos solo si los hay, con coma', () => {
    expect([dollarsLabel(10), dollarsLabel(7.5), dollarsLabel(12.25)]).toEqual(['US$10', 'US$7,50', 'US$12,25']);
  });
});

describe('quién la ve', () => {
  // EL DEFECTO: la pantalla se le ofrecería a quien el backend le responde 403 (CA-33).
  test('⛔ solo el superadministrador: la ruta lo exige y el menú no se la muestra a nadie más, aunque tenga todos los módulos', () => {
    expect(ROUTE_TABLE.find((r) => r.path === 'voice')?.access).toBe('superadmin');
    expect(menuFor(ana).some((item) => item.path === '/voice')).toBe(false);
    expect(menuFor(jose).find((item) => item.path === '/voice')).toEqual({ path: '/voice', label: 'Tope de la voz', group: 'business', icon: 'voz' });
  });

  // EL DEFECTO: esconder el menú no protege: sin el 403 de la ruta, la pantalla cargaría con la dirección escrita a mano.
  test('⛔ a otra persona del equipo, la ruta responde 403 sin cargar la pantalla', async () => {
    const sessions = { destroy: async () => ({ cookie: '', session: null }) } as unknown as SessionService;
    const pedir = async (member: TeamMember) => {
      const middleware = permissionsMiddleware({ members: () => ({ load: async () => ({ kind: 'member', member }) }), sessions: () => sessions, log: () => {} });
      return runMiddleware(middleware, '/voice', contextOf(member));
    };
    const deAna = await pedir(ana);
    expect([deAna.reached, deAna.thrownStatus]).toEqual([false, 403]);
    expect((await pedir(jose)).reached).toBe(true);
  });
});

describe('en pantalla', () => {
  // EL DEFECTO: el superadmin no sabría cuánto rige hoy, y el navegador no frenaría antes un tope que el backend rechaza.
  test('⛔ dice el tope que rige y si es el de por omisión; el máximo del backend frena los campos en el navegador', () => {
    const html = renderPage({ ...CRUDO, general: POR_OMISION });
    expect(html).toContain('US$10 por persona al mes');
    expect(html).toContain('Nadie: es el de por omisión');
    expect([fieldOf(html, 'general-usd'), fieldOf(html, 'exception-usd')].map((f) => /<input[^>]*max="20"/.test(f))).toEqual([true, true]);
  });

  // EL DEFECTO: con dos formularios en la pantalla, si los dos botones mandaran lo mismo, la acción no
  // sabría cuál leer, y al oprimir uno el otro también diría «Guardando…».
  test('⛔ cada formulario manda su propio pedido: su botón lleva su intención', () => {
    const html = renderPage(CRUDO);
    const buttons = html.match(/<button type="submit"[^>]*>/g) ?? [];
    expect(buttons.map((b) => [b.match(/name="([^"]+)"/)?.[1], b.match(/value="([^"]+)"/)?.[1]])).toEqual([['intent', 'general'], ['intent', 'exception']]);
  });

  // EL DEFECTO: el rechazo en el otro formulario, o sin el enlace para volver a ingresar el código, dejaría al
  // superadmin sin saber qué hacer, y perdería lo escrito.
  test('⛔ un rechazo del MFA se lee en el formulario del tope general, con cómo volver a ingresar el código y con lo escrito', () => {
    const html = renderPage(CRUDO, { intent: 'general', values: { usd: '7.5', reason: 'medido' }, errors: {}, rejection: { code: 'recent-mfa' } });
    const general = formWithClass(html, 'general-cap-form');
    expect([general.includes('Ingresar el código'), general.includes('returnTo=%2Fvoice'), tagWith(general, 'input', 'id="general-usd"').includes('value="7.5"')]).toEqual([true, true, true]);
    expect(formWithClass(html, 'cap-exception-form')).not.toContain('class="banner"');
  });

  // EL DEFECTO: el rechazo lejos del campo de la cuenta, o repetido en el otro formulario, no diría qué corregir.
  test('⛔ una cuenta que no existe se dice junto a la cuenta, en el formulario de la excepción, y en ningún otro', () => {
    const html = renderPage(CRUDO, { intent: 'exception', values: { accountId: 'nadie-000000', usd: '5', reason: 'x' }, errors: {}, rejection: { code: 'not-found' } });
    const cuenta = fieldOf(html, 'exception-account');
    expect([cuenta.includes('Esa cuenta no existe o no está disponible.'), cuenta.includes('value="nadie-000000"')]).toEqual([true, true]);
    expect(html.split('Esa cuenta no existe o no está disponible.').length - 1).toBe(1);
    expect(formWithClass(html, 'general-cap-form')).not.toContain('class="banner"');
  });

  // EL DEFECTO: con el filtro de clientes puesto, el superadmin creería que no hay más excepciones que las que ve.
  test('⛔ con el filtro de clientes, avisa que faltan cuentas', () => {
    expect([renderPage({ ...CRUDO, soloAlgunas: true }), renderPage(CRUDO)].map((h) => h.includes('Por ahora el panel muestra solo las empresas de prueba.'))).toEqual([true, false]);
  });

  // EL DEFECTO: un clic suelto en «Quitar» le cambiaría el tope a una cuenta sin confirmación ni motivo.
  test('⛔ «Quitar» abre la confirmación, que pide el motivo, dice a cuánto vuelve y lleva la cuenta en el cuerpo', () => {
    const tabla = render(createElement(CapExceptionsTable, { exceptions: [AUTECO], onRemove: () => {} }));
    expect([tabla.includes('type="submit"'), /<button type="button"[^>]*>Quitar<\/button>/.test(tabla)]).toEqual([false, true]);
    const dialogo = render(createElement(RemoveExceptionDialog, { exception: AUTECO, generalUsd: 10, attempt: null, onClose: () => {} }));
    expect(dialogo).toContain('Hoy tiene un tope de US$15. Sin la excepción vuelve al general: US$10 por persona al mes.');
    const cuenta = tagWith(dialogo, 'input', 'name="accountId"');
    expect([cuenta.includes('type="hidden"'), cuenta.includes('value="auteco-4d5e6f"'), tagWith(dialogo, 'input', 'name="reason"').includes('required=""')]).toEqual([true, true, true]);
    expect((dialogo.match(/<button type="submit"[^>]*>/g) ?? []).map((b) => b.match(/value="([^"]+)"/)?.[1])).toEqual(['remove-exception']);
    expect(dialogo).toMatch(/<form[^>]*action="\/voice"/);
  });
});
