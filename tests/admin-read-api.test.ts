// Las lecturas de M2a de la API de admin: qué pide el panel y cómo traduce lo que recibe (CA-29).
//
// EL DEFECTO QUE PREVIENE. El panel pinta lo que sale de aquí. Si la traducción confundiera un
// campo (los asientos usados con el tope, «personalizado» con un tier), el equipo vería datos
// equivocados de un cliente sin ningún error. Y si el correo de la búsqueda viajara en la URL,
// quedaría en los logs de acceso de API Gateway.
import { describe, expect, test } from 'vitest';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { ApiContractError } from '../app/shared/api/api-reading';

type Seen = { method: string; url: string; body: string | null; authorization: string | null };

function apiAnswering(answer: (url: string) => Response) {
  const seen: Seen[] = [];
  const logs: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ method: init?.method ?? 'GET', url: String(input), body: (init?.body as string) ?? null, authorization: new Headers(init?.headers).get('authorization') });
    return answer(String(input));
  }) as typeof fetch;
  return { api: createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl, log: (m) => logs.push(m) }), seen, logs };
}

const EMPRESA = {
  id: 'acme-000001', nombre: 'Acme', tipo: 'empresa', plan: 'personalizado', estado: 'active',
  vencimiento: { vencido: false, vencidoPor: null, hasta: '2026-12-31' }, aviso: null,
  asientos: { usados: 2, tope: 5 }, admins: 1, pagaPorStripe: true, creadaEl: '2026-10-01T00:00:00.000Z',
};

describe('las empresas', () => {
  test('la lista: pide con el tipo, el plan y la página en los nombres del backend, y traduce cada campo, la página y el conteo', async () => {
    const conteo = {
      empresas: { total: 15, planes: { free: 1, pro: 2, team: 5, personalizado: 7 } },
      personales: { total: 381, planes: { free: 0, pro: 4, team: 0, personalizado: 377 } },
    };
    const paginacion = { pagina: 2, paginas: 8, total: 377, porPagina: 50 };
    const { api, seen } = apiAnswering(() => Response.json({ clientes: [EMPRESA], paginacion, conteo, soloAlgunas: true }));
    const r = await api.listCompanies('token-ana', { kind: 'company', plan: 'custom', page: 2 });
    expect(seen).toEqual([{ method: 'GET', url: 'https://api.example/v1/admin/clientes?tipo=empresa&plan=personalizado&pagina=2', body: null, authorization: 'Bearer token-ana' }]);
    expect(r).toEqual({
      kind: 'ok',
      value: {
        companies: [{
          id: 'acme-000001', name: 'Acme', kind: 'company', person: null, origin: null, plan: 'custom', status: 'active',
          expiry: { expired: false, expiredBy: null, until: '2026-12-31' }, notice: null,
          seats: { used: 2, cap: 5 }, admins: 1, paysWithStripe: true, createdAt: '2026-10-01T00:00:00.000Z',
        }],
        page: { page: 2, pages: 8, total: 377, perPage: 50 },
        counts: {
          companies: { total: 15, plans: { free: 1, pro: 2, team: 5, custom: 7 } },
          personal: { total: 381, plans: { free: 0, pro: 4, team: 0, custom: 377 } },
        },
        onlySome: true,
      },
    });
  });

  test('una cuenta personal llega con su persona y su estado traducido', async () => {
    const persona = { correo: 'maria@gmail.com', estado: 'activo', invitadoEl: 'a', aceptadoEl: 'b' };
    const { api, seen } = apiAnswering(() => Response.json({ clientes: [{ ...EMPRESA, tipo: 'personal', persona }], soloAlgunas: false }));
    const r = await api.listCompanies('t', { kind: 'personal', plan: null });
    expect(seen[0]?.url).toBe('https://api.example/v1/admin/clientes?tipo=personal');
    expect(r.kind === 'ok' && r.value.companies[0]).toMatchObject({ kind: 'personal', person: { email: 'maria@gmail.com', status: 'active', invitedAt: 'a', acceptedAt: 'b' } });
  });

  test('sin conteo (el backend de antes), cada número es cero y la lista no se rompe', async () => {
    const { api } = apiAnswering(() => Response.json({ clientes: [], soloAlgunas: false }));
    const r = await api.listCompanies('t', { kind: 'company', plan: null });
    expect(r.kind === 'ok' && r.value.counts.personal).toEqual({ total: 0, plans: { free: 0, pro: 0, team: 0, custom: 0 } });
  });

  test('⛔ la búsqueda de cuentas manda el texto, el tipo y el plan en el cuerpo de un POST, nunca en la URL', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ clientes: [{ ...EMPRESA, tipo: 'personal', persona: null }], hayMas: true, soloAlgunas: false }));
    const r = await api.searchCompanies('t', { text: 'maria@', kind: 'personal', plan: 'custom' });
    expect(seen[0]).toMatchObject({ method: 'POST', url: 'https://api.example/v1/admin/clientes/buscar', body: '{"texto":"maria@","tipo":"personal","plan":"personalizado"}' });
    expect(r.kind === 'ok' && [r.value.companies[0]?.person, r.value.hasMore, r.value.onlySome]).toEqual([null, true, false]);
  });

  test('la ficha trae el plan efectivo, las condiciones y el acceso; sin acceso, el motivo', async () => {
    const ficha = {
      ...EMPRESA,
      planEfectivo: { tier: 'team', preset: 'pro', flags: { collaboration: true, scheduling: false }, cupos: { radar: 5 }, asientos: 5, manejaAsientos: true },
      condiciones: { asientos: 5, contenido: 'nada' },
      acceso: { base: 'nada', reglas: [{ clave: 'skill:x', accion: 'dar', inexistente: true, inactiva: false }], cuenta: { skills: 3, agentes: 1, cadenas: 0 } },
    };
    const { api } = apiAnswering(() => Response.json(ficha));
    const r = await api.getCompany('t', 'acme-000001');
    expect(r.kind === 'ok' && r.value.effectivePlan).toEqual({ tier: 'team', preset: 'pro', flags: { collaboration: true, scheduling: false }, quotas: { radar: 5 }, seats: 5, managesSeats: true });
    expect(r.kind === 'ok' && r.value.access).toEqual({ base: 'nothing', rules: [{ key: 'skill:x', action: 'grant', missing: true, inactive: false }], counts: { skills: 3, agents: 1, chains: 0 } });
    expect(r.kind === 'ok' && r.value.conditions).toEqual({ seats: 5, content: 'nothing', team: null, scheduling: null, until: null, quotas: {} });

    const sinAcceso = apiAnswering(() => Response.json({ ...EMPRESA, planEfectivo: null, condiciones: null, acceso: null, accesoPendiente: 'corre npm run publicar' }));
    const r2 = await sinAcceso.api.getCompany('t', 'acme-000001');
    expect(r2.kind === 'ok' && [r2.value.access, r2.value.accessPending, r2.value.effectivePlan]).toEqual([null, 'corre npm run publicar', null]);
  });

  test('⛔ un cupo sin tope (`null` en el backend) llega como `null`, no como un número ni como texto', async () => {
    const { api } = apiAnswering(() => Response.json({
      ...EMPRESA, planEfectivo: { tier: 'pro', preset: 'pro', flags: {}, cupos: { radar: null, proyectos: null, skills: 6, cadenas: null }, asientos: 1, manejaAsientos: false },
      condiciones: null, acceso: null,
    }));
    const r = await api.getCompany('t', 'acme-000001');
    expect(r.kind === 'ok' && r.value.effectivePlan?.quotas).toEqual({ radar: null, projects: null, skills: 6, chains: null });
  });

  test('una fila vieja sin preset no tumba la ficha: lo que falta sale en null (CB-5)', async () => {
    const { api } = apiAnswering(() => Response.json({ ...EMPRESA, planEfectivo: { tier: 'pro', flags: {}, cupos: {}, asientos: 1 }, condiciones: null, acceso: null }));
    const r = await api.getCompany('t', 'acme-000001');
    expect(r.kind === 'ok' && r.value.effectivePlan?.preset).toBeNull();
  });

  test('la historia: cada evento con su origen, quién, qué y por qué', async () => {
    const { api } = apiAnswering(() => Response.json({ historia: [
      { origen: 'auditoria', fecha: '2026-10-05T00:00:00Z', actor: 'equipo:jose', canal: 'api', que: 'empresas.prueba', motivo: 'probar', antes: null, despues: { x: 1 } },
      { origen: 'cuenta', fecha: '2026-10-01T00:00:00Z', actor: null, que: 'alta', motivo: null, detalle: { presetId: 'pro' } },
    ] }));
    expect(await api.getCompanyHistory('t', 'acme-000001')).toEqual({ kind: 'ok', value: [
      { source: 'audit', at: '2026-10-05T00:00:00Z', actor: 'equipo:jose', what: 'empresas.prueba', reason: 'probar', channel: 'api', detail: null, before: null, after: { x: 1 } },
      { source: 'account', at: '2026-10-01T00:00:00Z', actor: null, what: 'alta', reason: null, channel: null, detail: { presetId: 'pro' }, before: null, after: null },
    ] });
  });

  test('un campo que el panel no conoce se ignora y queda en el log, sin romper', async () => {
    const { api, logs } = apiAnswering(() => Response.json({ clientes: [{ ...EMPRESA, campoNuevo: 1 }], soloAlgunas: false }));
    const r = await api.listCompanies('t', { kind: 'company', plan: null });
    expect(r.kind).toBe('ok');
    expect(logs.some((l) => l.includes('campoNuevo'))).toBe(true);
  });

  test('⛔ una respuesta sin la forma acordada lanza ApiContractError: nunca llega torcida a la pantalla', async () => {
    const { api } = apiAnswering(() => Response.json({ clientes: [{ nombre: 'sin id' }] }));
    await expect(api.listCompanies('t', { kind: 'company', plan: null })).rejects.toThrow(ApiContractError);
  });
});

/** Una página de `GET /v1/admin/cuentas?tipo=personal`, como la responde el backend (pieza E). */
const PERSONA = { correo: 'maria@gmail.com', estado: 'activo', invitadoEl: 'a', aceptadoEl: null };
const ceros = { registro: 0, codigo: 0, compra: 0, webinar: 0, equipo: 0 };
const CONTADORES = {
  empresas: { total: 12, porOrigen: { ...ceros, compra: 3, equipo: 9 } },
  personales: { total: 5012, porOrigen: { registro: 4300, codigo: 200, compra: 80, webinar: 381, equipo: 51 } },
};
const CURSOR = Buffer.from('2026-11-13T15:00:00.000Z#registro-a1b2c3').toString('base64url');
const cuentaPersonal = (id: string, nacidaDe: unknown) => ({ ...EMPRESA, id, tipo: 'personal', plan: 'free', pagaPorStripe: false, persona: PERSONA, nacidaDe });
const paginaDelIndice = (extra: Record<string, unknown> = {}) => ({
  cuentas: [cuentaPersonal('registro-a1b2c3', 'registro')], siguiente: CURSOR, contadores: CONTADORES, soloAlgunas: false,
  contadoresCompletos: true, rellenadoEl: '2026-11-14T15:00:00.000Z', ...extra,
});

describe('las cuentas personales por el índice (spec «Registro abierto», CA-23 y CA-24)', () => {
  test('⛔ CA-24 · pide `/v1/admin/cuentas` solo con el tipo y, después de la primera, el cursor: cualquier otro parámetro es un 422', async () => {
    // EL DEFECTO: con `plan`, `pagina` o `limite` de más, el backend responde 422 y la pestaña entera queda en error.
    const { api, seen } = apiAnswering(() => Response.json(paginaDelIndice()));
    await api.listPersonalAccounts('token-ana', { after: null });
    await api.listPersonalAccounts('token-ana', { after: CURSOR });
    expect(seen.map((s) => [s.method, s.url, s.authorization])).toEqual([
      ['GET', 'https://api.example/v1/admin/cuentas?tipo=personal', 'Bearer token-ana'],
      ['GET', `https://api.example/v1/admin/cuentas?tipo=personal&desde=${CURSOR}`, 'Bearer token-ana'],
    ]);
  });

  test('⛔ CA-23 · cada cuenta trae su origen, y los contadores sus números por origen, con los nombres del panel', async () => {
    // EL DEFECTO: un origen o un contador leído con otro nombre mostraría «Compra en la web» donde dice «Webinar», sin error.
    const origenes = ['registro', 'codigo', 'compra', 'webinar', 'equipo'];
    const { api } = apiAnswering(() => Response.json(paginaDelIndice({ cuentas: origenes.map((o, i) => cuentaPersonal(`c${i}-000000`, o)) })));
    const r = await api.listPersonalAccounts('t', { after: null });
    if (r.kind !== 'ok') throw new Error(`respondió ${r.kind}`);
    expect(r.value.accounts.map((a) => a.origin)).toEqual(['signup', 'code', 'purchase', 'webinar', 'team']);
    expect(r.value.counts).toEqual({
      companies: { total: 12, byOrigin: { signup: 0, code: 0, purchase: 3, webinar: 0, team: 9 } },
      personal: { total: 5012, byOrigin: { signup: 4300, code: 200, purchase: 80, webinar: 381, team: 51 } },
    });
    expect([r.value.next, r.value.onlySome, r.value.accounts[0]?.person?.email]).toEqual([CURSOR, false, 'maria@gmail.com']);
  });

  test('⛔ D-17 · sin la marca del relleno del índice, los contadores no llegan a la pantalla: ni con `false` ni sin el dato', async () => {
    // EL DEFECTO: antes del relleno, los contadores no cuentan las cuentas que ya existían. Leídos igual, la
    // pestaña mostraría un «0» o un número a medias como si fueran ciertos; un backend sin el dato tampoco los garantiza.
    const sinRellenar = { ...paginaDelIndice({ contadoresCompletos: false }) } as Record<string, unknown>;
    delete sinRellenar.rellenadoEl;
    const sinDato = { ...paginaDelIndice() } as Record<string, unknown>;
    delete sinDato.contadoresCompletos;
    delete sinDato.rellenadoEl;
    for (const body of [sinRellenar, sinDato]) {
      const { api } = apiAnswering(() => Response.json(body));
      const r = await api.listPersonalAccounts('t', { after: null });
      if (r.kind !== 'ok') throw new Error(`respondió ${r.kind}`);
      // La lista que sí hay se muestra igual: lo que se calla son solo los números.
      expect([r.value.counts, r.value.accounts.length], JSON.stringify(body).slice(-60)).toEqual([null, 1]);
    }
  });

  test('un origen que el panel no conoce no se cambia por otro: queda sin dato y en el log', async () => {
    const { api, logs } = apiAnswering(() => Response.json(paginaDelIndice({ cuentas: [cuentaPersonal('rara-000000', 'invitacion')] })));
    const r = await api.listPersonalAccounts('t', { after: null });
    expect(r.kind === 'ok' && r.value.accounts[0]?.origin).toBeNull();
    expect(logs.some((l) => l.includes('invitacion'))).toBe(true);
  });

  test('⛔ un `siguiente` que no es un cursor, o un contador que no es un número, rompen el contrato: nunca llegan torcidos a la pantalla', async () => {
    // EL DEFECTO: un cursor roto haría que «Siguiente» llevara siempre al aviso de la primera página; un contador sin número, a un «0» falso.
    const malas = [
      paginaDelIndice({ siguiente: 'no es un cursor' }),
      paginaDelIndice({ siguiente: undefined }),
      paginaDelIndice({ contadores: { ...CONTADORES, personales: { total: '5012', porOrigen: CONTADORES.personales.porOrigen } } }),
      paginaDelIndice({ contadores: { ...CONTADORES, empresas: { total: 12, porOrigen: { registro: 0 } } } }),
    ];
    for (const mala of malas) {
      const { api } = apiAnswering(() => Response.json(mala));
      await expect(api.listPersonalAccounts('t', { after: null }), JSON.stringify(mala).slice(0, 80)).rejects.toThrow(ApiContractError);
    }
  });
});

describe('las personas', () => {
  test('⛔ la búsqueda manda el texto y la empresa en el cuerpo de un POST, nunca en la URL', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ personas: [], hayMas: false, soloAlgunas: true }));
    expect(await api.searchPeople('t', { text: 'ana', company: 'acme-000001' })).toEqual({ kind: 'ok', value: { people: [], hasMore: false, onlySome: true } });
    expect(seen[0]).toMatchObject({ method: 'POST', url: 'https://api.example/v1/admin/personas/buscar', body: '{"texto":"ana","empresa":"acme-000001"}' });
  });

  test('solo las cuentas personales: la lista pide `tipo=personal` y la búsqueda lo manda en el cuerpo', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ personas: [], hayMas: false, soloAlgunas: false }));
    await api.listClientUsers('t', { company: '', kind: 'personal', page: 1 });
    await api.searchPeople('t', { text: 'ana', company: '', kind: 'personal' });
    expect(seen[0]?.url).toBe('https://api.example/v1/admin/personas?tipo=personal');
    expect(seen[1]?.body).toBe('{"texto":"ana","empresa":"","tipo":"personal"}');
  });

  test('la lista: pide con el filtro de empresa y la página, y trae cada persona con su empresa y su estado traducido', async () => {
    const { api, seen } = apiAnswering(() => Response.json({
      personas: [{ correo: 'bea@otra.com', empresa: { id: 'otra-000002', nombre: 'Otra', tipo: 'empresa' }, rol: null, admin: true, estado: 'invitado', invitadoEl: 'a', aceptadoEl: null }],
      paginacion: { pagina: 3, paginas: 3, total: 101, porPagina: 50 }, soloAlgunas: true,
      empresas: [{ id: 'otra-000002', nombre: 'Otra', tipo: 'empresa', equipo: true }, { id: 'webinar-000003', nombre: 'Webinar', tipo: 'personal', equipo: false }],
    }));
    const r = await api.listClientUsers('token-ana', { company: 'acme', page: 3 });
    expect(seen).toEqual([{ method: 'GET', url: 'https://api.example/v1/admin/personas?empresa=acme&pagina=3', body: null, authorization: 'Bearer token-ana' }]);
    expect(r).toEqual({ kind: 'ok', value: {
      people: [{ email: 'bea@otra.com', company: { id: 'otra-000002', name: 'Otra', kind: 'company' }, role: null, isAdmin: true, status: 'invited', invitedAt: 'a', acceptedAt: null }],
      page: { page: 3, pages: 3, total: 101, perPage: 50 },
      companies: [{ id: 'otra-000002', name: 'Otra', kind: 'company' }, { id: 'webinar-000003', name: 'Webinar', kind: 'personal' }],
      onlySome: true,
    } });
  });

  test('la búsqueda que encuentra: cada persona con su empresa y su estado traducido, y si hubo más', async () => {
    const { api } = apiAnswering(() => Response.json({
      personas: [{ correo: 'beto@acme.com', empresa: { id: 'acme-000001', nombre: 'Acme', tipo: 'personal' }, rol: 'ventas', admin: false, estado: 'en-pausa', invitadoEl: 'a', aceptadoEl: null }],
      hayMas: true, soloAlgunas: false,
    }));
    expect(await api.searchPeople('t', { text: 'beto', company: '' })).toEqual({ kind: 'ok', value: {
      people: [{ email: 'beto@acme.com', company: { id: 'acme-000001', name: 'Acme', kind: 'personal' }, role: 'ventas', isAdmin: false, status: 'paused', invitedAt: 'a', acceptedAt: null }],
      hasMore: true,
      onlySome: false,
    } });
  });

  test('las personas de una empresa: lo que ve cada una y la empresa a la que pertenecen', async () => {
    const { api } = apiAnswering(() => Response.json({
      cliente: { id: 'acme-000001', nombre: 'Acme', tipo: 'personal' },
      empresa: { dominios: [{ slug: 'convert', skills: ['copy'] }], cuenta: { skills: 1, agentes: 0, cadenas: 0 } },
      roles: [{ slug: 'ventas', label: 'Ventas', base: 'nada', vacio: false, reglas: [{}, {}], personas: 1 }],
      personas: [{ correo: 'beto@acme.com', rol: 'ventas', admin: false, estado: 'activo', ve: { tipo: 'rol', rol: 'ventas', ajustes: 1 }, cuenta: { skills: 1, agentes: 0, cadenas: 0 }, invitadoEl: 'a', aceptadoEl: null }],
      revocadas: [{ correo: 'dani@acme.com', revocadoEl: 'b' }],
      bitacora: [{ accion: 'invito', actor: 'ana@acme.com', sobre: 'beto@acme.com', cuando: 'c' }],
    }));
    const r = await api.getCompanyPeople('t', 'acme-000001');
    expect(r.kind === 'ok' && r.value.company).toEqual({ id: 'acme-000001', name: 'Acme', kind: 'personal' });
    expect(r.kind === 'ok' && r.value.people[0]?.sees).toEqual({ kind: 'role', role: 'ventas', adjustments: 1 });
    expect(r.kind === 'ok' && r.value.roles[0]).toEqual({ slug: 'ventas', label: 'Ventas', base: 'nothing', empty: false, people: 1, rules: 2 });
    expect(r.kind === 'ok' && r.value.people[0]?.status).toBe('active');
  });

  test('la revisión de datos: cada tipo de hallazgo con su nombre en el panel', async () => {
    const { api } = apiAnswering(() => Response.json({
      hallazgos: { asientosSinIndice: [{ tenantId: 'acme-000001', correo: 'x@acme.com', estado: 'activo' }], empresasSinAdmin: [{ tenantId: 'acme-000001', nombre: 'Acme', pagaPorStripe: true }] },
      total: 2, fueraDeLoVisible: 3, soloAlgunas: true,
    }));
    const r = await api.getDataCheckup('t');
    expect(r.kind === 'ok' && r.value.findings.seatsWithoutIndex).toEqual([{ companyId: 'acme-000001', email: 'x@acme.com', detail: 'activo' }]);
    expect(r.kind === 'ok' && r.value.findings.companiesWithoutAdmin[0]?.detail).toBe('paga por Stripe');
    expect(r.kind === 'ok' && [r.value.total, r.value.outsideVisible, r.value.findings.orphanCredentials]).toEqual([2, 3, []]);
  });
});

describe('la auditoría y el equipo', () => {
  test('la auditoría: pide con el objetivo, sin página la primera, y traduce cada evento', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ eventos: [
      { fecha: 'f', actor: 'equipo:jose', canal: 'api', operacion: 'equipo.alta', objetivo: 'equipo#nati', motivo: 'm', antes: null, despues: null },
    ], paginacion: { pagina: 1, paginas: 1, total: 1, porPagina: 50 }, soloAlgunas: true }));
    const r = await api.listAuditEvents('t', { target: 'equipo#nati', page: 1 });
    expect(seen[0]?.url).toBe('https://api.example/v1/admin/auditoria?objetivo=equipo%23nati');
    expect(r).toEqual({ kind: 'ok', value: {
      events: [{ at: 'f', actor: 'equipo:jose', channel: 'api', operation: 'equipo.alta', target: 'equipo#nati', reason: 'm', before: null, after: null }],
      page: { page: 1, pages: 1, total: 1, perPage: 50 },
      onlySome: true,
    } });
  });

  test('la auditoría: una página después de la primera viaja como `pagina`', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ eventos: [], paginacion: { pagina: 3, paginas: 4, total: 160, porPagina: 50 }, soloAlgunas: false }));
    await api.listAuditEvents('t', { target: null, page: 3 });
    expect(seen[0]?.url).toBe('https://api.example/v1/admin/auditoria?pagina=3');
  });

  test('el equipo: cada persona con la forma de /yo', async () => {
    const { api } = apiAnswering(() => Response.json({ personas: [
      { actor: 'equipo:nati', correo: 'nati@beenso.com', nombre: 'Nati', superadmin: false, estado: 'suspendida', permisos: { empresas: 'ver' } },
    ] }));
    expect(await api.listTeam('t')).toEqual({ kind: 'ok', value: [
      { actor: 'equipo:nati', email: 'nati@beenso.com', name: 'Nati', isSuperadmin: false, status: 'inactive', permissions: { companies: 'view' } },
    ] });
  });
});

describe('qué hace el panel con cada respuesta', () => {
  test('⛔ un 200 que no es JSON es el contrato roto (ApiContractError), no un error suelto', async () => {
    const { api } = apiAnswering(() => new Response('<html>', { status: 200 }));
    await expect(api.getDataCheckup('t')).rejects.toThrow(ApiContractError);
  });

  test.each([
    [404, 'not-found'], [403, 'forbidden'], [401, 'unauthorized'], [422, 'invalid'], [400, 'invalid'],
  ] as const)('%i → %s', async (status, kind) => {
    const { api } = apiAnswering(() => Response.json({ error: 'x' }, { status }));
    expect(await api.getCompany('t', 'acme-000001')).toEqual({ kind });
  });

  test('⛔ un 5xx, un 429 o no responder lanzan AdminApiUnavailableError: no son «no existe»', async () => {
    for (const status of [500, 502, 503, 429]) {
      const { api } = apiAnswering(() => new Response('x', { status }));
      await expect(api.getDataCheckup('t')).rejects.toThrow(AdminApiUnavailableError);
    }
    const offline = createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch });
    await expect(offline.listTeam('t')).rejects.toThrow(AdminApiUnavailableError);
  });

  test('el id de la empresa va codificado en la ruta', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ historia: [] }));
    await api.getCompanyHistory('t', 'a/b');
    expect(seen[0]?.url).toBe('https://api.example/v1/admin/clientes/a%2Fb/historia');
  });
});
