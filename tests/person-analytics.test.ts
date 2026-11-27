// La analítica de una persona desde el panel (spec «Analítica de una persona», CA-10 a CA-13).
//
// EL DEFECTO QUE PREVIENE. Que quien solo ve Usuarios de clientes deje de compartir la analítica de alguien —o que
// quien la ve no encuentre dónde—; que el correo viaje en una dirección y quede en los registros de acceso; que el panel
// le mande al backend sus nombres en inglés, o un motivo vacío que el backend anotaría como si fuera uno; que un estado
// que el panel no conoce se muestre como «comparte»; que soporte deje de compartir creyendo que eso borra lo ya enviado;
// que después de guardar el diálogo siga diciendo el estado viejo; y que un rechazo o un corte se pierda o deje el
// diálogo sin botón.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CompanyFile } from '../app/domain/companies';
import type { TeamMember } from '../app/domain/permissions';
import { analyticsChangeOffer, type PersonAnalytics } from '../app/domain/person-analytics';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { ApiContractError } from '../app/shared/api/api-reading';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { accessFor, allows } from '../app/shared/routing/route-access';
import type { AnalyticsAnswer } from '../app/shared/person-analytics/person-analytics-form-data';
import { analyticsDoneText, analyticsRejectionMessage } from '../app/shared/person-analytics/person-analytics-labels';
import { teamMember } from './helpers/fake-admin-api';

const personAnalytics = vi.fn();
const read = { getCompany: vi.fn(), getCompanyHistory: vi.fn(), getVoiceCaps: vi.fn(), getCompanyPeople: vi.fn() };
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ personAnalytics }) }));
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => read }));
const analyticsRoute = await import('../app/modules/client-users/routes/person-analytics');
const peopleRoute = await import('../app/modules/client-users/routes/company-people');
const companyRoute = await import('../app/modules/companies/routes/company');
const { PeoplePanel } = await import('../app/modules/client-users/components/people-panel');
const { PersonAnalyticsDialog } = await import('../app/shared/person-analytics/person-analytics-dialog');
const { AnalyticsOverview } = await import('../app/shared/person-analytics/analytics-overview');
const { AnalyticsChangeForm } = await import('../app/shared/person-analytics/analytics-change-form');

const ID = 'acme-1a2b3c';
const EMAIL = 'ana@acme.com';
/** Ve Usuarios de clientes, sin poder cambiar nada. */
const lectora = teamMember('luisa', { permissions: { clientUsers: 'view', companies: 'view' } });
/** Edita Usuarios de clientes. */
const editora = teamMember('eva', { permissions: { clientUsers: 'edit', companies: 'view' } });
/** Ve Empresas, y nada de Usuarios de clientes. */
const deEmpresas = teamMember('emilio', { permissions: { companies: 'edit' } });

/** La respuesta 200 del contrato al ver: retirada, con una aceptación completa y otra a la que le faltan datos. */
const VIEW_BODY = {
  tenantId: ID, correo: EMAIL, analitica: 'retirada', cambiadaEl: '2026-11-27T15:00:00.000Z',
  terminos: [
    { version: '2026-10', aceptadoEl: '2026-10-28T15:00:00.000Z', registradoEl: '2026-10-28T15:00:03.120Z', donde: 'registro', nombreDeclarado: 'Ana Ruiz' },
    { version: '2026-11', aceptadoEl: null, registradoEl: '2026-11-10T15:00:04.120Z', donde: 'ventana', nombreDeclarado: null },
  ],
};
const WITHDRAWN: PersonAnalytics = {
  sharing: 'withdrawn', changedAt: '2026-11-27T15:00:00.000Z', changed: null,
  termsAcceptances: [
    { version: '2026-10', acceptedAt: '2026-10-28T15:00:00.000Z', recordedAt: '2026-10-28T15:00:03.120Z', place: 'signup', declaredName: 'Ana Ruiz' },
    { version: '2026-11', acceptedAt: null, recordedAt: '2026-11-10T15:00:04.120Z', place: 'app-window', declaredName: null },
  ],
};
const SHARING: PersonAnalytics = { sharing: 'sharing', changedAt: null, changed: null, termsAcceptances: [] };

const PERSONA = { email: EMAIL, isAdmin: false, role: null, status: 'active', sees: { kind: 'all' }, counts: { skills: 0, agents: 0, chains: 0 }, invitedAt: null, acceptedAt: null };
const PERSONAL_FILE: CompanyFile = {
  id: 'maria-0000a1', name: 'Webinar C1', kind: 'personal', person: { email: 'maria@gmail.com', status: 'active', invitedAt: null, acceptedAt: null },
  origin: 'code', plan: 'custom', status: 'active', expiry: { expired: false, expiredBy: null, until: null }, notice: null,
  seats: { used: 1, cap: 1 }, admins: 1, paysWithStripe: false, stripeCanCharge: false, createdAt: '2026-10-28T15:00:00Z',
  effectivePlan: null, conditions: null, access: null, accessPending: null,
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

const post = (fields: Record<string, string>, member: TeamMember = editora) => analyticsRoute.action({
  request: new Request(`https://dxxxx.cloudfront.net/client-users/${ID}/analytics`, { method: 'POST', body: formOf(fields) }),
  context: contextOf(member), params: { companyId: ID },
} as never);

function render<P extends object>(Component: ComponentType<P>, props: P, at = `/client-users/${ID}`) {
  const Stub = createRoutesStub([{ path: '*', Component: () => createElement(Component, props) }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

/** El botón con ese texto, entero, o `''`. */
const buttonWith = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>(?:<[^>]+>)*${label}</button>`))?.[0] ?? '';

function writeApiAnswering(respond: () => Response) {
  const seen: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
    return respond();
  }) as unknown as typeof fetch;
  return { api: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), seen };
}

/** El fetcher de guardar en el estado que se quiere mirar: el diálogo se lo pasa al formulario. */
const saveFetcher = (data?: AnalyticsAnswer, state: 'idle' | 'submitting' = 'idle') => ({
  state, data, formMethod: state === 'idle' ? undefined : 'post',
  Form: (props: object) => createElement('form', props),
}) as never;

const changeForm = (sharing: PersonAnalytics['sharing'], save = saveFetcher()) =>
  render(AnalyticsChangeForm, { save, path: `/client-users/${ID}/analytics`, email: EMAIL, sharing });

beforeEach(() => {
  personAnalytics.mockReset();
  for (const fn of Object.values(read)) fn.mockReset();
  read.getCompanyHistory.mockResolvedValue({ kind: 'ok', value: [] });
  read.getCompanyPeople.mockResolvedValue({ kind: 'ok', value: { company: { id: ID, name: 'Acme', kind: 'company' } } });
});

describe('CA-10 · quién ve «Analítica y términos» y dónde', () => {
  test('⛔ la ruta del diálogo pide «ver» en Usuarios de clientes: «editar» en Empresas no alcanza', () => {
    const access = accessFor(new URL(`https://dxxxx.cloudfront.net/client-users/${ID}/analytics`));
    expect(access).toEqual({ module: 'clientUsers', level: 'view' });
    expect([allows(lectora, access!), allows(deEmpresas, access!)]).toEqual([true, false]);
  });

  test('⛔ las personas de una cuenta y la ficha la dejan ver con «ver» en Usuarios, y cambiar solo con «editar»', async () => {
    const people = (member: TeamMember) => peopleRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/client-users/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);
    expect([(await people(lectora)).analytics, (await people(editora)).analytics]).toEqual([{ canSee: true, canChange: false }, { canSee: true, canChange: true }]);
    read.getCompany.mockResolvedValue({ kind: 'ok', value: PERSONAL_FILE });
    const file = (member: TeamMember) => companyRoute.loader({ request: new Request(`https://dxxxx.cloudfront.net/companies/${ID}`), context: contextOf(member), params: { companyId: ID } } as never);
    expect([(await file(lectora)).analytics, (await file(deEmpresas)).analytics]).toEqual([{ canSee: true, canChange: false }, { canSee: false, canChange: false }]);
  });

  test('⛔ el menú de cada persona la ofrece a quien solo ve Usuarios, aunque no tenga ninguna otra acción', () => {
    const panel = (canSee: boolean) => render(PeoplePanel, {
      people: [PERSONA] as never, roles: [], companyId: ID, companyName: 'Acme', personal: false,
      actor: { superadmin: false, editUsers: false }, lastAttempt: null, credits: { canSee: false, canLoad: false }, analytics: { canSee, canChange: false },
    });
    expect(panel(true)).toContain('>Analítica y términos</button>');
    expect(panel(true)).toContain('>Acciones</button>');
    expect(panel(false)).not.toContain('Acciones');
  });

  test('⛔ la tarjeta «Persona» de una cuenta personal la ofrece con «ver» en Usuarios, y sin él no', () => {
    const fileWith = (canSee: boolean) => render(companyRoute.default as ComponentType<object>, {
      loaderData: {
        file: PERSONAL_FILE, history: [], canSeePeople: canSee, canDelete: false, canChangePlan: false, planBlock: null, statusAction: null,
        voiceCap: null, house: null, personActions: [], credits: { canSee: false, canLoad: false }, analytics: { canSee, canChange: false },
      },
    }, `/companies/${PERSONAL_FILE.id}`);
    expect(buttonWith(fileWith(true), 'Analítica y términos')).not.toBe('');
    expect(fileWith(false)).not.toContain('Analítica y términos');
  });

  test('⛔ cambiarla se ofrece solo con «editar», y no a un asiento revocado', () => {
    expect(analyticsChangeOffer({ canSee: true, canChange: false }, 'active')).toBeNull();
    expect(analyticsChangeOffer({ canSee: true, canChange: true }, 'active')).toBe('offered');
    expect(analyticsChangeOffer({ canSee: true, canChange: true }, 'revoked')).toBe('seat-revoked');
  });
});

describe('CA-11 a CA-13 · lo que viaja al backend y lo que vuelve', () => {
  test('⛔ va por POST a la cuenta de la ruta, en los nombres del backend y con el correo en el cuerpo; el motivo, solo si se escribió', async () => {
    const { api, seen } = writeApiAnswering(() => Response.json(VIEW_BODY));
    await api.personAnalytics('t', ID, { action: 'view', email: EMAIL, reason: null });
    await api.personAnalytics('t', ID, { action: 'withdraw', email: EMAIL, reason: 'lo pidió por correo' });
    await api.personAnalytics('t', ID, { action: 'restore', email: EMAIL, reason: null });
    const url = `https://api.example/v1/admin/clientes/${ID}/analitica`;
    expect(seen).toEqual([
      { url, method: 'POST', body: { accion: 'ver', correo: EMAIL } },
      { url, method: 'POST', body: { accion: 'retirar', correo: EMAIL, motivo: 'lo pidió por correo' } },
      { url, method: 'POST', body: { accion: 'devolver', correo: EMAIL } },
    ]);
  });

  test('⛔ la respuesta llega con los nombres del panel, sin inventar lo que la prueba no trae', async () => {
    const { api } = writeApiAnswering(() => Response.json(VIEW_BODY));
    expect(await api.personAnalytics('t', ID, { action: 'view', email: EMAIL, reason: null })).toEqual({ kind: 'ok', value: WITHDRAWN });
  });

  test('`cambio` solo viene al cambiar: `false` dice que ya estaba así', async () => {
    const { api } = writeApiAnswering(() => Response.json({ ...VIEW_BODY, analitica: 'compartiendo', cambio: false }));
    const r = await api.personAnalytics('t', ID, { action: 'restore', email: EMAIL, reason: null });
    expect(r.kind === 'ok' && [r.value.sharing, r.value.changed]).toEqual(['sharing', false]);
  });

  test('⛔ un estado de la analítica que el panel no conoce rompe el contrato: no se muestra como «comparte»', async () => {
    const { api } = writeApiAnswering(() => Response.json({ ...VIEW_BODY, analitica: 'pausada' }));
    await expect(api.personAnalytics('t', ID, { action: 'view', email: EMAIL, reason: null })).rejects.toBeInstanceOf(ApiContractError);
  });

  test('⛔ cada rechazo del contrato vuelve como rechazo, con los nombres del panel', async () => {
    const casos: [number, object, object][] = [
      [404, { codigo: 'no-existe' }, { code: 'not-found' }],
      [422, { codigo: 'invalido', error: 'falta el correo de la persona' }, { code: 'invalid', message: 'falta el correo de la persona', field: null }],
      [409, { codigo: 'asiento-revocado' }, { code: 'seat-revoked' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { api } = writeApiAnswering(() => Response.json(body, { status }));
      expect(await api.personAnalytics('t', ID, { action: 'withdraw', email: EMAIL, reason: null })).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });
});

describe('la ruta del diálogo', () => {
  test('⛔ ver llega a la API sin motivo, también para quien solo ve Usuarios, y vuelve al diálogo', async () => {
    personAnalytics.mockResolvedValue({ kind: 'ok', value: WITHDRAWN });
    expect(await post({ analytics: 'view', email: EMAIL, reason: 'no viaja' }, lectora)).toEqual({ ok: true, analytics: WITHDRAWN });
    expect(personAnalytics).toHaveBeenCalledWith('token', ID, { action: 'view', email: EMAIL, reason: null });
  });

  test('⛔ quien solo ve Usuarios y manda dejar de compartir recibe 403, y no llega a la API', async () => {
    await expect(post({ analytics: 'withdraw', email: EMAIL }, lectora)).rejects.toMatchObject({ init: { status: 403 } });
    expect(personAnalytics).not.toHaveBeenCalled();
  });

  test('⛔ el motivo es opcional: en blanco no viaja; escrito, va sin los espacios de los bordes', async () => {
    personAnalytics.mockResolvedValue({ kind: 'ok', value: { ...WITHDRAWN, changed: true } });
    await post({ analytics: 'withdraw', email: EMAIL, reason: '   ' });
    await post({ analytics: 'restore', email: EMAIL, reason: ' pidió volver a compartir ' });
    expect(personAnalytics.mock.calls.map((c) => c[2])).toEqual([
      { action: 'withdraw', email: EMAIL, reason: null },
      { action: 'restore', email: EMAIL, reason: 'pidió volver a compartir' },
    ]);
  });

  test('⛔ un motivo de más de 500 caracteres se dice junto al campo y no llega a la API', async () => {
    expect(await post({ analytics: 'withdraw', email: EMAIL, reason: 'x'.repeat(501) })).toEqual({ ok: false, rejection: null, errors: { reason: 'El motivo va hasta 500 caracteres.' } });
    expect(personAnalytics).not.toHaveBeenCalled();
  });

  test('⛔ si la API no responde, el diálogo lo dice en vez de cambiar la página por la de error', async () => {
    personAnalytics.mockRejectedValue(new AdminApiUnavailableError('sin respuesta'));
    expect(await post({ analytics: 'withdraw', email: EMAIL })).toEqual({ ok: false, rejection: { code: 'unavailable' }, errors: {} });
  });

  test('un pedido sin correo o con una acción que no existe no llega a la API', async () => {
    expect(await post({ analytics: 'withdraw', email: '' })).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    expect(await post({ analytics: 'delete', email: EMAIL })).toMatchObject({ ok: false, rejection: { code: 'invalid' } });
    expect(personAnalytics).not.toHaveBeenCalled();
  });

  test('⛔ ver no vuelve a pedir la pantalla de atrás; cambiar, sí (su bitácora cambia)', () => {
    const args = (fields: Record<string, string>) => ({ formData: formOf(fields), defaultShouldRevalidate: true }) as never;
    for (const route of [peopleRoute, companyRoute]) {
      expect(route.shouldRevalidate(args({ analytics: 'view', email: EMAIL }))).toBe(false);
      expect(route.shouldRevalidate(args({ analytics: 'withdraw', email: EMAIL }))).toBe(true);
    }
  });
});

describe('CA-11 · lo que dice el diálogo', () => {
  test('⛔ al abrir dice que está leyendo y no ofrece cambiar nada antes de saber cómo está', () => {
    const html = render(PersonAnalyticsDialog, { email: EMAIL, companyId: ID, change: 'offered', onClose: () => {} });
    expect(html).toContain(`Analítica y términos de ${EMAIL}`);
    expect(html).toContain('Leyendo su analítica y sus términos…');
    expect(html).not.toContain('<form');
    expect([buttonWith(html, 'Dejar de compartir'), buttonWith(html, 'Volver a compartir')]).toEqual(['', '']);
  });

  test('⛔ dice desde cuándo no comparte, y la prueba de cada versión: fechas, dónde y el nombre que escribió', () => {
    const html = render(AnalyticsOverview, { answer: { ok: true, analytics: WITHDRAWN }, current: WITHDRAWN });
    expect(html).toContain('No comparte su uso desde el 27 nov 2026, 10:00.');
    expect([...html.matchAll(/<th>([^<]+)<\/th>/g)].map((m) => m[1])).toEqual(['Versión', 'Fecha del clic', 'Fecha registrada', 'Dónde', 'Nombre que escribió']);
    expect(html).toMatch(/<td class="small mono">2026-10<\/td><td class="small">28 oct 2026, 10:00<\/td><td class="small">28 oct 2026, 10:00<\/td><td class="small">en el registro<\/td><td class="small">Ana Ruiz<\/td>/);
    expect(html).toMatch(/<td class="small mono">2026-11<\/td><td class="small">—<\/td><td class="small">10 nov 2026, 10:00<\/td><td class="small">en la ventana de la app<\/td><td class="small">—<\/td>/);
  });

  test('⛔ sin aceptaciones lo dice, en vez de una tabla vacía', () => {
    const html = render(AnalyticsOverview, { answer: { ok: true, analytics: SHARING }, current: SHARING });
    expect(html).toContain('Comparte su uso.');
    expect(html).toContain('Sin aceptación registrada en el backend.');
    expect(html).not.toContain('<table');
  });

  test('un rechazo al abrir se dice en el diálogo, en su contexto', () => {
    const html = render(AnalyticsOverview, { answer: { ok: false, rejection: { code: 'not-found' }, errors: {} }, current: null });
    expect(html).toContain('Esta persona ya no tiene asiento en esta cuenta');
  });
});

describe('CA-12 y CA-13 · cambiarla', () => {
  test('⛔ a quien comparte se le ofrece dejar de compartir, con el recordatorio de que lo ya enviado no se borra y cómo borrarlo', () => {
    const html = changeForm('sharing');
    expect(buttonWith(html, 'Dejar de compartir')).not.toBe('');
    expect(html).toContain('Esto no borra lo que ya se envió.');
    expect(html).toContain('búscala por su correo en el proveedor de analítica y usa «Delete person and data»');
    expect(html).toContain('Motivo (opcional)');
    expect(html).not.toMatch(/<textarea[^>]*required/);
  });

  test('a quien no comparte se le ofrece volver a compartir, sin el recordatorio de borrar', () => {
    const html = changeForm('withdrawn');
    expect(buttonWith(html, 'Volver a compartir')).not.toBe('');
    expect(html).not.toContain('Dejar de compartir');
    expect(html).not.toContain('Delete person and data');
  });

  test('⛔ el correo y la acción van en el cuerpo del formulario, y la dirección no lleva el correo', () => {
    const html = changeForm('sharing');
    expect(html.match(/<form[^>]*action="([^"]*)"/)?.[1]).toBe(`/client-users/${ID}/analytics`);
    expect(html).toContain('<input type="hidden" name="analytics" value="withdraw"/>');
    expect(html).toContain(`<input type="hidden" name="email" value="${EMAIL}"/>`);
  });

  test('⛔ después de dejar de compartir dice que quedó hecho y vuelve a recordar cómo borrar lo ya enviado', () => {
    const saved = { ...WITHDRAWN, changed: true };
    const html = changeForm('withdrawn', saveFetcher({ ok: true, analytics: saved }));
    expect(html).toContain('Listo: ya no comparte su uso. Su ENSŌ deja de enviar en la próxima sincronización.');
    expect(html).toContain('Delete person and data');
    expect(buttonWith(html, 'Volver a compartir')).not.toBe('');
  });

  test('pedir lo que ya estaba dice que no cambió nada', () => {
    expect(analyticsDoneText({ sharing: 'withdrawn', changed: false })).toBe('Ya no compartía su uso: no cambió nada.');
    expect(analyticsDoneText({ sharing: 'sharing', changed: true })).toBe('Listo: vuelve a compartir su uso desde la próxima sincronización de su ENSŌ.');
  });

  test('⛔ mientras guarda, el botón queda bloqueado y dice qué hace', () => {
    const html = changeForm('sharing', saveFetcher(undefined, 'submitting'));
    expect(html).toMatch(/<button type="submit" class="btn primary submit-button" disabled="" aria-busy="true">.*Dejando de compartir…<\/button>/);
  });

  test('⛔ un rechazo al guardar se dice en el diálogo y el botón vuelve a estar disponible', () => {
    const html = changeForm('sharing', saveFetcher({ ok: false, rejection: { code: 'seat-revoked' }, errors: {} }));
    expect(html).toContain('Esta persona tiene el acceso revocado: ya no entra a ENSŌ con esta cuenta, y su analítica no se cambia.');
    expect(buttonWith(html, 'Dejar de compartir')).not.toContain('disabled');
  });

  test('⛔ un corte se explica distinto al abrir y al guardar; un `invalido` usa el texto del backend', () => {
    expect(analyticsRejectionMessage({ code: 'unavailable' }, 'view')).toContain('cierra el diálogo y vuelve a abrirlo');
    expect(analyticsRejectionMessage({ code: 'unavailable' }, 'change')).toContain('si ya se hizo, no cambia nada');
    expect(analyticsRejectionMessage({ code: 'invalid', message: 'x' }, 'change')).toBeUndefined();
  });
});
