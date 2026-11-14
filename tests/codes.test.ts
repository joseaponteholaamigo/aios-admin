// El módulo «Códigos» del panel (spec «Códigos de registro»: CA-1 a CA-7, CB-13, CB-14; y CA-31 de la
// spec «Registro abierto» de aios-tower: todo código lleva tope).
//
// EL DEFECTO QUE PREVIENE. Una hora del formulario mandada sin zona hace que el código venza cinco
// horas antes en producción; un código escrito a mano que se manda sin tope se puede adivinar, y uno
// generado sin tope que se filtra deja crear cuentas Pro sin límite con el registro abierto; un
// nombre del backend mal traducido pinta un estado o una duración equivocados, o deja ver el correo
// de una cuenta borrada; y una acción que no es pausar, reanudar ni revocar llegaría al backend como
// si lo fuera. Del lado de los permisos, si «codigos» no se tradujera, nadie del equipo vería el módulo.
// En pantalla: un reintento con otra clave crearía dos códigos, un solo clic en «Revocar» quemaría un
// código sin vuelta, y quien solo puede ver vería botones que el backend le rechaza.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { actionsFor } from '../app/domain/codes';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { toBackendNewCode, toCodeDetail, toCodes } from '../app/shared/api/codes-mapping';
import { toWriteRejection } from '../app/shared/api/write-mapping';
import { toTeamMember } from '../app/shared/api/team-member-mapping';
import { CAP_REQUIRED, readNewCode } from '../app/modules/codes/new-code-form-data';
import { ACTION_LABELS, durationLabel, statusLabel, usesLabel, creditsLabel } from '../app/modules/codes/code-labels';
import { CodeActions } from '../app/modules/codes/components/code-actions';
import { CodeFacts } from '../app/modules/codes/components/code-facts';
import { RedemptionsTable } from '../app/modules/codes/components/redemptions-table';
import { RevokeCodeDialog } from '../app/modules/codes/components/revoke-code-dialog';
import type { RegistrationCode } from '../app/domain/codes';

const createCode = vi.fn();
const changeCodeState = vi.fn();
const listCodes = vi.fn();
const getCode = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ createCode, changeCodeState }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listCodes, getCode }) }));
const { action: crear, default: CodeNew, shouldRevalidate } = await import('../app/modules/codes/routes/code-new');
const { action: cambiar, loader: detalle } = await import('../app/modules/codes/routes/code');
const { loader: lista } = await import('../app/modules/codes/routes/codes');

const member: TeamMember = { actor: 'equipo:sub', email: null, name: null, isSuperadmin: false, status: 'active', permissions: { codes: 'edit' } };
const KEY = '0123456789abcdef0123';

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function contextOf(who: TeamMember = member) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  context.set(teamMemberContext, who);
  return context;
}

function post(url: string, fields: Record<string, string>, route: typeof crear, params: Record<string, string> = {}) {
  return route({ request: new Request(`https://dxxxx.cloudfront.net${url}`, { method: 'POST', body: formOf(fields) }), context: contextOf(), params } as never);
}

/** Lo que dibuja un componente del módulo, dentro de un router (usa `Form` y `Link`). */
function render(element: ReturnType<typeof createElement>) {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ['/codes/WEBINAR-NOV'] }));
}

const ACTIVO: RegistrationCode = {
  code: 'WEBINAR-NOV', label: 'Webinar', generated: false, from: '2026-11-01T05:00:00.000Z', until: '2026-12-01T04:59:00.000Z', cap: 300, uses: 37, liveReservations: 4,
  duration: { kind: 'months', n: 2 }, monthlyCredits: 1000, dailyBrake: 200, status: 'active', pausedBy: null, createdAt: '2026-11-01T05:00:00.000Z',
};

const FORM = { code: '', label: 'Webinar de noviembre', from: '', until: '2026-11-30T23:59', cap: '300', durationKind: 'months', durationN: '2', monthlyCredits: '1000', dailyBrake: '200', reason: '', key: KEY };

beforeEach(() => { createCode.mockReset(); changeCodeState.mockReset(); listCodes.mockReset(); getCode.mockReset(); });

describe('el formulario de un código nuevo', () => {
  test('⛔ las fechas van en hora de Bogotá, con su zona; un código vacío se genera', () => {
    const r = readNewCode(formOf(FORM));
    expect('code' in r && [r.code.code, r.code.until, r.code.from, r.code.duration]).toEqual([null, '2026-11-30T23:59:00-05:00', null, { kind: 'months', n: 2 }]);
  });

  test('⛔ CA-2 · uno escrito a mano va en mayúsculas, y sin tope no se acepta: se puede adivinar', () => {
    const sinTope = readNewCode(formOf({ ...FORM, code: 'webinar-nov', cap: '' }));
    expect('errors' in sinTope && Object.keys(sinTope.errors)).toEqual(['cap']);
    const conTope = readNewCode(formOf({ ...FORM, code: 'webinar-nov', cap: '300' }));
    expect('code' in conTope && [conTope.code.code, conTope.code.cap]).toEqual(['WEBINAR-NOV', 300]);
  });

  // EL DEFECTO (CA-31): con el registro abierto, un código generado sin tope que se filtra deja crear
  // cuentas Pro sin límite con alias de un mismo buzón. El panel no lo manda y dice por qué.
  test('⛔ CA-31 · un código generado sin tope tampoco se acepta: lo dice junto al tope', () => {
    const r = readNewCode(formOf({ ...FORM, code: '', cap: '' }));
    expect('errors' in r && r.errors).toEqual({ cap: CAP_REQUIRED });
    const soloEspacios = readNewCode(formOf({ ...FORM, cap: '   ' }));
    expect('errors' in soloEspacios && soloEspacios.errors.cap).toBe(CAP_REQUIRED);
  });

  // EL DEFECTO: un tope de 0, negativo o con decimales viajaría como si fuera un tope, o el mensaje diría
  // que falta cuando sí se escribió algo.
  test('un tope que no es un entero mayor que cero dice su campo, con su propio mensaje', () => {
    for (const cap of ['0', '-3', '2.5', 'diez']) {
      const r = readNewCode(formOf({ ...FORM, cap }));
      expect('errors' in r && r.errors, cap).toEqual({ cap: 'El tope es un número entero mayor que cero.' });
    }
  });

  test('⛔ CB-13 · lo que no tiene forma dice su campo', () => {
    const r = readNewCode(formOf({ ...FORM, until: '', monthlyCredits: '1001', durationN: '40', code: 'abc' }));
    expect('errors' in r && Object.keys(r.errors).sort()).toEqual(['code', 'monthlyCredits', 'until']);
    const sinDias = readNewCode(formOf({ ...FORM, durationN: '40' }));
    expect('errors' in sinDias && Object.keys(sinDias.errors)).toEqual(['durationN']);
  });

  test('⛔ unos créditos borrados no viajan como «sin créditos»: se piden', () => {
    const r = readNewCode(formOf({ ...FORM, monthlyCredits: '' }));
    expect('errors' in r && Object.keys(r.errors)).toEqual(['monthlyCredits']);
  });

  test('una hora con segundos (lo que manda algún navegador) se acepta, en hora de Bogotá', () => {
    const r = readNewCode(formOf({ ...FORM, until: '2026-11-30T23:59:30' }));
    expect('code' in r && r.code.until).toBe('2026-11-30T23:59:30-05:00');
  });

  test('una fecha fija y sin fin son duraciones', () => {
    const hasta = readNewCode(formOf({ ...FORM, durationKind: 'until', durationDate: '2027-01-31' }));
    const sinFin = readNewCode(formOf({ ...FORM, durationKind: 'no-end' }));
    expect(['code' in hasta && hasta.code.duration, 'code' in sinFin && sinFin.code.duration]).toEqual([{ kind: 'until', date: '2027-01-31' }, { kind: 'no-end' }]);
  });
});

describe('la traducción con el backend', () => {
  const CRUDO = {
    codigo: 'WEBINAR-NOV', etiqueta: 'Webinar', generado: false, desde: '2026-11-01T05:00:00.000Z', hasta: '2026-12-01T04:59:00.000Z',
    tope: 300, usos: 37, reservasVigentes: 4, duracion: { meses: 2 }, creditosAlMes: 1000, frenoDiario: 200, estado: 'pausado',
    motivoDePausa: 'freno-diario', creadoEl: '2026-11-01T05:00:00.000Z',
  };

  test('un código de la lista, con su estado y por qué está en pausa', () => {
    const c = toCodes({ codigos: [CRUDO] })[0]!;
    expect([c.status, c.pausedBy, c.duration, usesLabel(c), statusLabel(c).text]).toEqual(['paused', 'brake', { kind: 'months', n: 2 }, '37 de 300', 'En pausa por el freno del día']);
  });

  test('⛔ CA-4 · el canje de una cuenta borrada no trae ni correo ni cuenta', () => {
    const d = toCodeDetail({ codigo: { ...CRUDO, canjes: [{ correo: null, cuenta: null, canjeadoEl: '2026-11-02T00:00:00Z', borrada: true }] } });
    expect(d.redemptions).toEqual([{ email: null, accountId: null, redeemedAt: '2026-11-02T00:00:00Z', deleted: true }]);
  });

  // EL DEFECTO (CA-31): si el tope no viajara, el backend rechazaría cada código nuevo con 422 en `tope`.
  test('⛔ CA-31 · el pedido de crear viaja en los nombres del backend, siempre con el tope; lo no elegido no viaja', () => {
    const r = readNewCode(formOf({ ...FORM, reason: 'para el webinar' }));
    expect('code' in r && toBackendNewCode(r.code)).toEqual({
      etiqueta: 'Webinar de noviembre', hasta: '2026-11-30T23:59:00-05:00', tope: 300, duracion: { meses: 2 }, creditosAlMes: 1000, frenoDiario: 200, motivo: 'para el webinar', clave: KEY,
    });
  });

  test('un rechazo con campo va junto a ese campo del formulario', () => {
    expect(toWriteRejection({ codigo: 'invalido', campo: 'duracion', error: 'x' })?.rejection).toEqual({ code: 'invalid', message: 'x', field: 'duration' });
    expect(toWriteRejection({ codigo: 'codigo-existe' })?.rejection).toEqual({ code: 'code-exists' });
  });

  test('⛔ el módulo «codigos» del backend es «Códigos» del panel: sin la traducción, nadie lo vería', () => {
    const m = toTeamMember({ actor: 'equipo:sub', estado: 'activa', superadmin: false, permisos: { codigos: 'ver' } }, () => {});
    expect(m.permissions).toEqual({ codes: 'view' });
  });

  test('cómo se dicen la duración y los créditos', () => {
    expect([durationLabel({ kind: 'days', n: 1 }), durationLabel({ kind: 'no-end' }), creditsLabel(0), creditsLabel(1000)]).toEqual(['1 día desde el canje', 'sin fin', 'sin créditos', '1.000 al mes']);
  });
});

describe('las rutas', () => {
  test('⛔ CA-1 · crear lleva al detalle del código nuevo, con el aviso', async () => {
    createCode.mockResolvedValue({ kind: 'ok', value: { code: 'ENSO-AAAA-BBBB-CCCC' } });
    const r = (await post('/codes/new', FORM, crear)) as Response;
    expect(createCode).toHaveBeenCalledWith('token-ana', expect.objectContaining({ key: KEY, until: '2026-11-30T23:59:00-05:00' }));
    expect(r.headers.get('Location')).toBe('/codes/ENSO-AAAA-BBBB-CCCC?aviso=creado');
  });

  // EL DEFECTO (CA-31): un código sin tope llegaría al backend, y lo escrito se perdería con el rechazo.
  test('⛔ CA-31 · sin tope, el panel no llama al backend: vuelve al formulario con lo escrito', async () => {
    const r = (await post('/codes/new', { ...FORM, cap: '' }, crear)) as { values: Record<string, string>; errors: Record<string, string> };
    expect([createCode.mock.calls.length, r.errors.cap, r.values.label]).toEqual([0, CAP_REQUIRED, 'Webinar de noviembre']);
  });

  test('un rechazo vuelve al formulario con lo escrito y la misma clave (CA-7)', async () => {
    createCode.mockResolvedValue({ kind: 'rejected', rejection: { code: 'code-exists' }, createdAccountId: null });
    const r = (await post('/codes/new', { ...FORM, code: 'WEBINAR-NOV', cap: '10' }, crear)) as { values: Record<string, string>; rejection: unknown };
    expect([r.values.key, r.values.code, r.rejection]).toEqual([KEY, 'WEBINAR-NOV', { code: 'code-exists' }]);
  });

  test('⛔ CA-5 · una acción del detalle llega al backend tal cual; una que no existe, no llega', async () => {
    changeCodeState.mockResolvedValue({ kind: 'ok', value: { code: 'WEBINAR-NOV' } });
    const r = (await post('/codes/WEBINAR-NOV', { accion: 'revoke', reason: ' se filtró ' }, cambiar as never, { code: 'WEBINAR-NOV' })) as Response;
    expect(changeCodeState).toHaveBeenCalledWith('token-ana', 'WEBINAR-NOV', 'revoke', 'se filtró');
    expect(r.headers.get('Location')).toBe('/codes/WEBINAR-NOV?aviso=revoke');
    changeCodeState.mockClear();
    await post('/codes/WEBINAR-NOV', { accion: 'borrar' }, cambiar as never, { code: 'WEBINAR-NOV' });
    expect(changeCodeState).not.toHaveBeenCalled();
  });

  test('un revocado no ofrece acciones; uno en pausa, reanudar o revocar', () => {
    expect([actionsFor({ status: 'revoked' }), actionsFor({ status: 'paused' }), actionsFor({ status: 'expired' })]).toEqual([[], ['resume', 'revoke'], ['pause', 'revoke']]);
  });
});

describe('en pantalla', () => {
  const clave = (html: string) => html.match(/name="key" value="([^"]+)"/)?.[1];

  test('⛔ CA-7 · el formulario que vuelve con un rechazo lleva la clave del primer intento, no una nueva', () => {
    const html = render(createElement(CodeNew, {
      loaderData: { key: 'clave-nueva-de-la-carga-0000' },
      actionData: { values: { ...FORM, code: 'WEBINAR-NOV', cap: '10' }, errors: {}, rejection: { code: 'code-exists' } },
    } as never));
    expect(clave(html)).toBe(KEY);
  });

  test('el rechazo de un campo va junto a ese campo; el de un campo que el formulario no tiene, arriba', () => {
    const junto = render(createElement(CodeNew, { loaderData: { key: KEY }, actionData: { values: FORM, errors: {}, rejection: { code: 'code-exists' } } } as never));
    expect([junto.includes('class="banner"'), junto.includes('class="field-error"')]).toEqual([false, true]);
    const arriba = render(createElement(CodeNew, { loaderData: { key: KEY }, actionData: { values: FORM, errors: {}, rejection: { code: 'invalid', message: 'algo raro', field: 'otro' } } } as never));
    expect([arriba.includes('class="banner"'), arriba.includes('Algo raro')]).toEqual([true, true]);
  });

  // EL DEFECTO: si el formulario siguiera diciendo «Vacío: sin tope», la persona lo dejaría vacío y se
  // lo rechazarían sin aviso previo; y si el rechazo del backend en `tope` (422 de
  // `codigos-reglas.js#leerNumeros`) quedara lejos del campo, no sabría qué corregir.
  test('⛔ CA-31 · el tope es obligatorio en pantalla, y el rechazo del backend en `tope` va junto a él', () => {
    const rejection = toWriteRejection({ codigo: 'invalido', campo: 'tope', error: 'todo código lleva tope de usos' })?.rejection;
    const html = render(createElement(CodeNew, { loaderData: { key: KEY }, actionData: { values: { ...FORM, cap: '' }, errors: {}, rejection } } as never));
    const capField = html.match(/<div class="field"><label for="cap">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(capField).toMatch(/<input[^>]*id="cap"[^>]*required=""/);
    expect(capField).toContain('Todo código lleva tope de usos.');
    expect([html.includes('class="banner"'), /sin tope/i.test(html)]).toEqual([false, false]);
  });

  test('⛔ después de mandar el formulario no se pide otra clave', () => {
    const args = (formMethod: string | undefined) => ({ formMethod, defaultShouldRevalidate: true }) as never;
    expect([shouldRevalidate(args('POST')), shouldRevalidate(args(undefined))]).toEqual([false, true]);
  });

  test('⛔ CA-5 · «Revocar» no revoca con un clic: abre la confirmación; pausar sí va directo', () => {
    const html = render(createElement(CodeActions, { code: ACTIVO, rejection: null, rejectedAction: null }));
    expect([/type="submit"[^>]*value="pause"/.test(html), /value="revoke"/.test(html), /type="button"[^>]*>Revocar</.test(html)]).toEqual([true, false, true]);
  });

  test('⛔ el detalle dice que el freno cuenta reservas y canjes, y que un código en pausa nadie lo puede usar', () => {
    // EL DEFECTO: el freno cuenta también los canjes (CA-32 y CA-39 de «Registro abierto»), y el día de la versión
    // la reserva desaparece. «200 reservas» o «nadie puede reservarlo» harían creer al equipo que el freno ya no
    // cuenta nada y que un código en pausa todavía se puede canjear.
    const facts = render(createElement(CodeFacts, { code: ACTIVO }));
    expect(facts).toContain('<dt>Freno del día</dt><dd>200 por día (reservas y canjes)</dd>');
    const pausado = (pausedBy: 'team' | 'brake') => render(createElement(CodeActions, { code: { ...ACTIVO, status: 'paused', pausedBy }, rejection: null, rejectedAction: null }));
    const [porElEquipo, porElFreno] = [pausado('team'), pausado('brake')];
    expect([porElEquipo.includes('Pausado, nadie puede usarlo'), porElFreno.includes('reanúdalo si el uso de hoy es legítimo')]).toEqual([true, true]);
    expect([facts, porElEquipo, porElFreno, ACTION_LABELS.pause.done].filter((text) => /reservarlo|reservas son|\d reservas</.test(text))).toEqual([]);
  });

  test('la confirmación manda «revoke», con el motivo que ya se había escrito', () => {
    const html = render(createElement(RevokeCodeDialog, { code: 'WEBINAR-NOV', actionField: 'accion', reason: 'se filtró', rejection: null, onClose: () => {} }));
    // React ordena los atributos a su modo (`value` antes que `name`): se mira cada botón entero.
    const envia = (html.match(/<button type="submit"[^>]*>/g) ?? []).filter((t) => t.includes('name="accion"') && t.includes('value="revoke"'));
    expect([envia.length, /name="reason"[^>]*value="se filtró"/.test(html)]).toEqual([1, true]);
  });

  test('un rechazo de revocar se lee en su diálogo, y una sola vez', () => {
    const html = render(createElement(CodeActions, { code: ACTIVO, rejection: { code: 'state-not-allowed' }, rejectedAction: 'revoke' }));
    const veces = html.split('cambió de estado mientras tanto').length - 1;
    expect([veces, /<dialog[\s\S]*cambió de estado mientras tanto[\s\S]*<\/dialog>/.test(html)]).toEqual([1, true]);
  });

  test('⛔ CA-4 · el canje de una cuenta borrada no muestra correo ni enlace', () => {
    const html = render(createElement(RedemptionsTable, { canSeeAccounts: true, redemptions: [{ email: null, accountId: null, redeemedAt: '2026-11-02T00:00:00Z', deleted: true }] }));
    expect([html.includes('Cuenta borrada'), html.includes('href="/companies')]).toEqual([true, false]);
  });

  test('sin «ver» en Empresas, la cuenta de un canje se muestra sin enlace', () => {
    const r = { email: 'eva@correo.com', accountId: 'codigo-1a2b3c', redeemedAt: '2026-11-02T00:00:00Z', deleted: false };
    const sin = render(createElement(RedemptionsTable, { canSeeAccounts: false, redemptions: [r] }));
    const con = render(createElement(RedemptionsTable, { canSeeAccounts: true, redemptions: [r] }));
    expect([sin.includes('codigo-1a2b3c'), sin.includes('href="/companies'), con.includes('href="/companies/codigo-1a2b3c"')]).toEqual([true, false, true]);
  });
});

describe('quien solo puede ver', () => {
  const soloVer: TeamMember = { ...member, permissions: { codes: 'view' } };
  const get = (url: string, route: (args: never) => unknown, params: Record<string, string> = {}): Promise<unknown> =>
    Promise.resolve(route({ request: new Request(`https://dxxxx.cloudfront.net${url}`), context: contextOf(soloVer), params } as never));

  test('⛔ CA-6 · con «ver» en Códigos, la lista no ofrece crear', async () => {
    listCodes.mockResolvedValue({ kind: 'ok', value: [ACTIVO] });
    const r = (await get('/codes', lista)) as { canCreate: boolean; codes: unknown[] };
    expect([r.codes.length, r.canCreate]).toEqual([1, false]);
  });

  test('⛔ CA-6 · con «ver» en Códigos, el detalle no ofrece acciones ni enlaza cuentas sin «ver» en Empresas', async () => {
    getCode.mockResolvedValue({ kind: 'ok', value: { ...ACTIVO, redemptions: [] } });
    const r = (await get('/codes/WEBINAR-NOV', detalle, { code: 'WEBINAR-NOV' })) as { canEdit: boolean; canSeeAccounts: boolean; code: { code: string } };
    expect([r.code.code, r.canEdit, r.canSeeAccounts]).toEqual(['WEBINAR-NOV', false, false]);
  });
});
