// La casa de una cuenta desde su ficha (spec «Reanudar la casa de una cuenta», CA-10 a CA-14).
//
// EL DEFECTO QUE PREVIENE. Que alguien que no es superadministrador vea los correos de los lotes congelados o mande
// quitar la pausa —toca créditos pagados y los servicios que paga ENSŌ—; que la ficha entera se caiga porque la casa
// no se pudo leer; que la tarjeta aparezca en una cuenta sin nada que revisar, o que no aparezca con una pausa o un lote
// congelado; que el panel mande sus nombres en inglés, un motivo vacío que el backend anotaría como uno, o el correo en
// una dirección; que un dato que falta se muestre como «sin pausa» o «0 créditos»; que alguien descongele un lote tras
// un reembolso porque el diálogo no se lo advirtió, o crea que quitar la pausa descongela; y que un rechazo se pierda.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CompanyFile } from '../app/domain/companies';
import { causeOfLot, type FrozenLot, type HouseReview } from '../app/domain/house';
import type { TeamMember } from '../app/domain/permissions';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { accessFor, allows } from '../app/shared/routing/route-access';
import { houseChangedNotice, houseChangedNoticeParams, houseDialogTexts, houseRejectionMessage } from '../app/modules/companies/house-labels';
import { teamMember } from './helpers/fake-admin-api';

const changeHouse = vi.fn();
const read = { getCompany: vi.fn(), getCompanyHistory: vi.fn(), getVoiceCaps: vi.fn(), getCompanyHouse: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ changeHouse }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const houseRoute = await import('../app/modules/companies/routes/company-house');
const companyRoute = await import('../app/modules/companies/routes/company');
const { CompanyHouseCard } = await import('../app/modules/companies/components/company-house-card');
const { HouseChangeDialog } = await import('../app/modules/companies/components/house-change-dialog');

const ID = 'acme-1a2b3c';
const EMAIL = 'ana@acme.com';
const LOT = 'lot_0123456789abcdef01234567';
const OTHER_LOT = 'lot_aaaaaaaaaaaaaaaaaaaaaaaa';
const jose = teamMember('jose', { isSuperadmin: true });
/** Todo lo de Empresas, Usuarios y Consumo, sin ser superadministradora. */
const ana = teamMember('ana', { permissions: { companies: 'edit', clientUsers: 'edit', usage: 'edit' } });

/** La respuesta 200 del contrato: pausa por un reembolso, un lote de ese mismo aviso y otro al que le faltan datos. */
const HOUSE_BODY = {
  tenantId: ID,
  pausa: { desde: '2026-11-20T15:00:00.000Z', motivo: 'reembolso', evento: 'evt_refund_1' },
  congelados: [
    { correo: EMAIL, lote: LOT, nombre: 'Paquete 500', creditos: 500, saldo: 300, vence: '2027-11-20', congeladoEl: '2026-11-20T15:00:01.000Z', evento: 'evt_refund_1' },
    { correo: 'beto@acme.com', lote: OTHER_LOT, nombre: null, creditos: 100, saldo: 100, vence: null, congeladoEl: null, evento: null },
  ],
};
const REFUND_LOT: FrozenLot = {
  email: EMAIL, lotId: LOT, name: 'Paquete 500', credits: 500, balance: 300, expiresAt: '2027-11-20', frozenAt: '2026-11-20T15:00:01.000Z', stripeEvent: 'evt_refund_1',
};
const BARE_LOT: FrozenLot = { email: 'beto@acme.com', lotId: OTHER_LOT, name: null, credits: 100, balance: 100, expiresAt: null, frozenAt: null, stripeEvent: null };
const PAUSED: HouseReview = { pause: { since: '2026-11-20T15:00:00.000Z', cause: 'refund', stripeEvent: 'evt_refund_1' }, frozenLots: [REFUND_LOT, BARE_LOT] };
const ONLY_LOTS: HouseReview = { pause: null, frozenLots: [BARE_LOT] };
const ONLY_PAUSE: HouseReview = { pause: PAUSED.pause, frozenLots: [] };
const EMPTY: HouseReview = { pause: null, frozenLots: [] };

const FILE: CompanyFile = {
  id: ID, name: 'Acme', kind: 'company', person: null, origin: null, plan: 'custom', status: 'active',
  expiry: { expired: false, expiredBy: null, until: null }, notice: null, seats: { used: 3, cap: 5 }, admins: 1,
  paysWithStripe: false, stripeCanCharge: false, createdAt: '2026-10-01T00:00:00Z', effectivePlan: null,
  conditions: null, access: null, accessPending: null,
};

function contextOf(member: TeamMember) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: member.actor, tokens: { accessToken: 'token' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return context;
}

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const post = (fields: Record<string, string>) => houseRoute.action({
  request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}/house`, { method: 'POST', body: formOf(fields) }),
  context: contextOf(jose), params: { companyId: ID },
} as never);

const openFile = (member: TeamMember) =>
  companyRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);

function render<P extends object>(Component: ComponentType<P>, props: P, at = `/companies/${ID}`) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

/** La ficha con la casa que se quiera mirar (`null`: quien mira no es superadministrador). */
const renderFile = (house: unknown) => render(companyRoute.default as ComponentType<object>, {
  loaderData: {
    file: FILE, history: [], canSeePeople: false, canDelete: false, canChangePlan: false, planBlock: null, statusAction: null,
    voiceCap: null, house, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false },
  },
});

const card = (house: HouseReview) => render(CompanyHouseCard, { view: { ok: true, house }, companyId: ID, companyTitle: 'Acme' });

function apiAnswering(respond: () => Response) {
  const seen: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, method: String(init.method), body: init.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return respond();
  }) as unknown as typeof fetch;
  const options = { baseUrl: 'https://api.example', fetchImpl, log: () => {} };
  return { read: createAdminReadApi(options), write: createAdminWriteApi(options), seen };
}

beforeEach(() => {
  changeHouse.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
  read.getCompany.mockResolvedValue({ kind: 'ok', value: FILE });
  read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
  read.getVoiceCaps.mockResolvedValue({ kind: 'ok', value: { general: { usd: 10 }, exceptions: [] } });
  read.getCompanyHouse.mockResolvedValue({ kind: 'ok', value: PAUSED });
});

describe('CA-10 · quién ve la tarjeta, y cuándo', () => {
  test('⛔ la ficha pide la casa solo para el superadministrador: con todos los módulos no alcanza, y no se pide', async () => {
    expect((await openFile(jose)).house).toEqual({ ok: true, house: PAUSED });
    read.getCompanyHouse.mockClear();
    expect((await openFile(ana)).house).toBeNull();
    expect(read.getCompanyHouse).not.toHaveBeenCalled();
  });

  test('⛔ la ruta que quita la pausa y descongela es solo del superadministrador', () => {
    const access = accessFor(new URL(`https://dxxxx.cloudfront.net/companies/${ID}/house`));
    expect(access).toBe('superadmin');
    expect([allows(ana, access!), allows(jose, access!)]).toEqual([false, true]);
  });

  test('⛔ un corte al leer la casa no tumba la ficha: la tarjeta dice que no se pudo, y el resto se muestra', async () => {
    read.getCompanyHouse.mockRejectedValue(new AdminApiUnavailableError('no responde'));
    const data = await openFile(jose);
    expect([data.file.id, data.house]).toEqual([ID, { ok: false }]);
    const html = renderFile(data.house);
    expect(html).toContain('No se pudo leer ahora si esta cuenta tiene servicios de ENSŌ en revisión.');
    expect(html).toContain('<h2>Plan</h2>');
  });

  test('⛔ la tarjeta aparece con una pausa o con lotes congelados, y no en una cuenta sin nada que revisar', () => {
    const TITLE = 'Servicios de ENSŌ en revisión';
    expect([ONLY_PAUSE, ONLY_LOTS].map((house) => renderFile({ ok: true, house }).includes(TITLE))).toEqual([true, true]);
    expect(renderFile({ ok: true, house: EMPTY })).not.toContain(TITLE);
    expect(renderFile(null)).not.toContain(TITLE);
  });
});

describe('CA-11 y CA-12 · lo que dice la tarjeta', () => {
  test('⛔ la pausa dice desde cuándo (hora de Bogotá), que fue un reembolso de Stripe, el aviso y qué significa', () => {
    const html = card(ONLY_PAUSE);
    expect(html).toContain('En pausa desde el 20 nov 2026, 10:00, por un reembolso de Stripe.');
    expect(html).toContain('Aviso de Stripe: <span class="mono">evt_refund_1</span>');
    expect(html).toContain('esta cuenta no puede usar los servicios que paga ENSŌ, como el video con IA y Contactos.');
    expect(html).toContain('>Quitar la pausa</button>');
  });

  test('⛔ cada lote dice de quién es, qué lote, lo que queda congelado de lo que tenía, desde cuándo y el aviso, con «Descongelar»', () => {
    const html = card(PAUSED);
    for (const text of [EMAIL, 'Paquete 500', '300 de 500', '20 nov 2026, 10:00', 'vence el 20 nov 2027', 'aria-label="Descongelar «Paquete 500» de ana@acme.com"']) {
      expect(html).toContain(text);
    }
  });

  test('lo que el backend no trae se dice como falta, sin inventarlo; sin pausa, la tarjeta lo aclara', () => {
    const html = card(ONLY_LOTS);
    expect(html).toContain('La cuenta no está en pausa');
    expect(html).toContain('Lote sin nombre');
    expect(html).toContain('<td class="small">—</td><td class="small mono">—</td>');
    expect(html).not.toContain('>Quitar la pausa</button>');
  });
});

describe('lo que viaja al backend y lo que vuelve', () => {
  test('⛔ la casa se lee por GET de la cuenta de la ruta, y llega con los nombres del panel', async () => {
    const { read: api, seen } = apiAnswering(() => Response.json(HOUSE_BODY));
    expect(await api.getCompanyHouse('t', ID)).toEqual({ kind: 'ok', value: PAUSED });
    expect(seen).toEqual([{ url: `https://api.example/v1/admin/clientes/${ID}/casa`, method: 'GET', body: undefined }]);
  });

  test('⛔ cambiar va por POST en los nombres del backend: el correo y el lote en el cuerpo, y el motivo solo si se escribió', async () => {
    const { write, seen } = apiAnswering(() => Response.json({ ...HOUSE_BODY, cambio: true }));
    await write.changeHouse('t', ID, { action: 'lift-pause', reason: null });
    await write.changeHouse('t', ID, { action: 'unfreeze', email: EMAIL, lotId: LOT, reason: 'se ganó la disputa' });
    const url = `https://api.example/v1/admin/clientes/${ID}/casa`;
    expect(seen).toEqual([
      { url, method: 'POST', body: { accion: 'quitar-pausa' } },
      { url, method: 'POST', body: { accion: 'descongelar', correo: EMAIL, lote: LOT, motivo: 'se ganó la disputa' } },
    ]);
  });

  test('`cambio: false` dice que ya estaba así; la casa vuelve ya cambiada', async () => {
    const { write } = apiAnswering(() => Response.json({ tenantId: ID, pausa: null, congelados: [], cambio: false }));
    expect(await write.changeHouse('t', ID, { action: 'lift-pause', reason: null })).toEqual({ kind: 'ok', value: { house: EMPTY, changed: false } });
  });

  test('⛔ un motivo de pausa que el panel no conoce no se adivina: la pausa se muestra igual, «por un aviso de Stripe»', async () => {
    const { read: api } = apiAnswering(() => Response.json({ ...HOUSE_BODY, pausa: { desde: null, motivo: 'fraude', evento: null } }));
    const r = await api.getCompanyHouse('t', ID);
    if (r.kind !== 'ok') throw new Error('la casa no se leyó');
    expect(r.value.pause).toEqual({ since: null, cause: null, stripeEvent: null });
    expect(card(r.value)).toContain('En pausa por un aviso de Stripe.');
  });

  test('⛔ sin el campo de la pausa, o con un saldo que no es número, rompe el contrato: no se muestra «sin pausa» ni «0»', async () => {
    const { pausa: _, ...sinPausa } = HOUSE_BODY;
    const saldoRaro = { ...HOUSE_BODY, congelados: [{ ...HOUSE_BODY.congelados[0], saldo: '300' }] };
    for (const body of [sinPausa, saldoRaro]) {
      const { read: api } = apiAnswering(() => Response.json(body));
      await expect(api.getCompanyHouse('t', ID)).rejects.toBeInstanceOf(ApiContractError);
    }
  });

  test('⛔ cada rechazo del contrato vuelve como rechazo, con los nombres del panel', async () => {
    const casos: [number, object, object][] = [
      [404, { codigo: 'no-existe', error: 'ese lote no es de esa persona en esta cuenta' }, { code: 'not-found' }],
      [422, { codigo: 'invalido', error: 'descongelar lleva el id del lote' }, { code: 'invalid', message: 'descongelar lleva el id del lote', field: null }],
      [503, { codigo: 'ocupado', error: 'los créditos de esa persona cambiaron' }, { code: 'busy' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { write } = apiAnswering(() => Response.json(body, { status }));
      expect(await write.changeHouse('t', ID, { action: 'unfreeze', email: EMAIL, lotId: LOT, reason: null })).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });
});

describe('CA-13 y CA-14 · la ruta de los diálogos', () => {
  test('⛔ el motivo es opcional: en blanco llega a la API sin motivo; quitar la pausa no lleva correo ni lote', async () => {
    changeHouse.mockResolvedValue({ kind: 'ok', value: { house: EMPTY, changed: true } });
    await post({ change: 'lift-pause', reason: '   ', email: EMAIL, lot: LOT });
    expect(changeHouse).toHaveBeenCalledWith('token', ID, { action: 'lift-pause', reason: null });
  });

  test('⛔ descongelar manda el correo, el lote y el motivo, y vuelve a la ficha con un aviso que no lleva el correo', async () => {
    changeHouse.mockResolvedValue({ kind: 'ok', value: { house: ONLY_PAUSE, changed: true } });
    const r = (await post({ change: 'unfreeze', email: EMAIL, lot: LOT, reason: ' se ganó la disputa ' })) as Response;
    expect(changeHouse).toHaveBeenCalledWith('token', ID, { action: 'unfreeze', email: EMAIL, lotId: LOT, reason: 'se ganó la disputa' });
    expect(r.headers.get('Location')).toBe(`/companies/${ID}?aviso=lote-descongelado`);
  });

  test('⛔ un motivo de más de 500 caracteres se dice junto al campo y no llega a la API', async () => {
    expect(await post({ change: 'lift-pause', reason: 'x'.repeat(501) })).toEqual({ ok: false, rejection: null, errors: { reason: 'El motivo va hasta 500 caracteres.' } });
    expect(changeHouse).not.toHaveBeenCalled();
  });

  test('descongelar sin el correo o sin el lote, o una acción que no es de las dos, no llega a la API', async () => {
    const incomplete: Record<string, string>[] = [{ change: 'unfreeze', lot: LOT }, { change: 'unfreeze', email: EMAIL }, { change: 'delete' }];
    for (const fields of incomplete) {
      expect(await post(fields)).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    }
    expect(changeHouse).not.toHaveBeenCalled();
  });

  test('⛔ un rechazo y un corte se quedan en el diálogo, que vuelve a ofrecer el botón', async () => {
    changeHouse.mockResolvedValue({ kind: 'rejected', rejection: { code: 'busy' }, createdAccountId: null });
    expect(await post({ change: 'unfreeze', email: EMAIL, lot: LOT })).toEqual({ ok: false, rejection: { code: 'busy' }, errors: {} });
    changeHouse.mockRejectedValue(new AdminApiUnavailableError('no responde'));
    expect(await post({ change: 'lift-pause' })).toEqual({ ok: false, rejection: { code: 'unavailable' }, errors: {} });
  });
});

describe('CA-13 · lo que dicen los diálogos para evitar el paso equivocado', () => {
  const dialog = (target: Parameters<typeof HouseChangeDialog>[0]['target'], house: HouseReview) =>
    render(HouseChangeDialog, { target, house, companyId: ID, companyTitle: 'Acme', onClose: () => {} });

  test('⛔ descongelar advierte que es solo si la plata volvió, y que tras un reembolso el lote se deja congelado', () => {
    const html = dialog({ action: 'unfreeze', lot: BARE_LOT }, ONLY_LOTS);
    expect(html).toContain('Descongela solo si la plata volvió: se ganó la disputa en Stripe.');
    expect(html).toContain('Tras un reembolso, deja el lote congelado: esa plata ya se le devolvió al cliente.');
  });

  test('⛔ un lote congelado por el mismo reembolso que pausó la cuenta lo dice; uno de otro aviso, no se adivina', () => {
    const facts = (lot: FrozenLot) => houseDialogTexts({ action: 'unfreeze', lot }, PAUSED, 'Acme').facts.map((f) => f.text).join(' ');
    expect(causeOfLot(REFUND_LOT, PAUSED.pause)).toBe('refund');
    expect(facts(REFUND_LOT)).toContain('pausó la cuenta por un reembolso: lo que corresponde es dejarlo congelado.');
    expect(causeOfLot(BARE_LOT, PAUSED.pause)).toBeNull();
    expect(facts(BARE_LOT)).not.toContain('pausó la cuenta por');
  });

  test('⛔ descongelar con la cuenta en pausa dice que no la quita; el correo y el lote van en campos del formulario', () => {
    const html = dialog({ action: 'unfreeze', lot: REFUND_LOT }, PAUSED);
    expect(html).toContain('La cuenta sigue en pausa: descongelar no la quita.');
    expect(html).toContain(`<input type="hidden" name="email" value="${EMAIL}"/>`);
    expect(html).toContain(`<input type="hidden" name="lot" value="${LOT}"/>`);
    expect(html).toContain(`action="/companies/${ID}/house"`);
  });

  test('⛔ quitar la pausa dice que devuelve los servicios, que siguen sus otros créditos y que los congelados siguen congelados', () => {
    const html = dialog({ action: 'lift-pause' }, PAUSED);
    expect(html).toContain('La cuenta vuelve a usar los servicios que paga ENSŌ');
    expect(html).toContain('siguen con sus otros créditos');
    expect(html).toContain('Los 2 lotes congelados siguen congelados: quitar la pausa no los descongela.');
    expect(html).not.toContain('name="email"');
  });

  test('el motivo es opcional y va hasta 500 caracteres', () => {
    const html = dialog({ action: 'lift-pause' }, ONLY_PAUSE);
    expect(html).toContain('Motivo (opcional)');
    expect(html).toMatch(/<textarea[^>]*name="reason"[^>]*maxLength="500"/);
    expect(html).not.toMatch(/<textarea[^>]*required/);
  });
});

describe('CA-14 · los rechazos y el aviso', () => {
  test('⛔ «no existe» se dice distinto para un lote y para la cuenta; «ocupado» y un corte dicen que se vuelva a oprimir', () => {
    expect(houseRejectionMessage({ code: 'not-found' }, 'unfreeze')).toContain('Ese lote ya no es de esta persona en esta cuenta');
    expect(houseRejectionMessage({ code: 'not-found' }, 'lift-pause')).toContain('Esta cuenta ya no existe');
    expect(houseRejectionMessage({ code: 'busy' }, 'unfreeze')).toContain('no se descongeló nada: vuelve a oprimir el botón');
    expect(houseRejectionMessage({ code: 'unavailable' }, 'lift-pause')).toContain('si ya se hizo, no cambia nada');
    expect(houseRejectionMessage({ code: 'invalid', message: 'x' }, 'unfreeze')).toBeUndefined();
  });

  test('⛔ el aviso de la ficha dice qué pasó, y que el otro paso sigue pendiente', () => {
    expect(houseChangedNotice(houseChangedNoticeParams({ action: 'lift-pause', changed: true }))).toContain('Los créditos congelados siguen congelados.');
    expect(houseChangedNotice(houseChangedNoticeParams({ action: 'unfreeze', changed: true }))).toContain('Descongelar no quita la pausa');
    expect(houseChangedNotice(houseChangedNoticeParams({ action: 'unfreeze', changed: false }))).toBe('Ese lote ya no estaba congelado: no cambió nada.');
    expect(houseChangedNotice(new URLSearchParams({ aviso: 'otra' }))).toBeNull();
  });

  test('⛔ después de guardar, la ficha muestra el aviso', () => {
    const html = render(companyRoute.default as ComponentType<object>, {
      loaderData: {
        file: FILE, history: [], canSeePeople: false, canDelete: false, canChangePlan: false, planBlock: null, statusAction: null,
        voiceCap: null, house: { ok: true, house: ONLY_LOTS }, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee: false, canChange: false },
      },
    }, `/companies/${ID}?aviso=pausa-quitada`);
    expect(html).toContain('Pausa quitada: la cuenta ya puede usar los servicios que paga ENSŌ.');
  });
});
