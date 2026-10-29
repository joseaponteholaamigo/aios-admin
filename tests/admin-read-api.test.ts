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
  id: 'acme-000001', nombre: 'Acme', plan: 'personalizado', estado: 'active',
  vencimiento: { vencido: false, vencidoPor: null, hasta: '2026-12-31' }, aviso: null,
  asientos: { usados: 2, tope: 5 }, admins: 1, pagaPorStripe: true, creadaEl: '2026-10-01T00:00:00.000Z',
};

describe('las empresas', () => {
  test('la lista: pide con la búsqueda y el cursor, y traduce cada campo', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ clientes: [EMPRESA], siguiente: 'c2', soloAlgunas: true }));
    const r = await api.listCompanies('token-ana', { query: 'acme', cursor: 'c1' });
    expect(seen).toEqual([{ method: 'GET', url: 'https://api.example/v1/admin/clientes?q=acme&cursor=c1', body: null, authorization: 'Bearer token-ana' }]);
    expect(r).toEqual({
      kind: 'ok',
      value: {
        companies: [{
          id: 'acme-000001', name: 'Acme', plan: 'custom', status: 'active',
          expiry: { expired: false, expiredBy: null, until: '2026-12-31' }, notice: null,
          seats: { used: 2, cap: 5 }, admins: 1, paysWithStripe: true, createdAt: '2026-10-01T00:00:00.000Z',
        }],
        next: 'c2',
        onlySome: true,
      },
    });
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
    const { api, logs } = apiAnswering(() => Response.json({ clientes: [{ ...EMPRESA, campoNuevo: 1 }], siguiente: null, soloAlgunas: false }));
    const r = await api.listCompanies('t', {});
    expect(r.kind).toBe('ok');
    expect(logs.some((l) => l.includes('campoNuevo'))).toBe(true);
  });

  test('⛔ una respuesta sin la forma acordada lanza ApiContractError: nunca llega torcida a la pantalla', async () => {
    const { api } = apiAnswering(() => Response.json({ clientes: [{ nombre: 'sin id' }] }));
    await expect(api.listCompanies('t', {})).rejects.toThrow(ApiContractError);
  });
});

describe('las personas', () => {
  test('⛔ la búsqueda manda el correo en el cuerpo de un POST, nunca en la URL', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ encontrada: false, soloAlgunas: true }));
    expect(await api.findPerson('t', 'ana@acme.com')).toEqual({ kind: 'ok', value: { found: false, onlySome: true } });
    expect(seen[0]).toMatchObject({ method: 'POST', url: 'https://api.example/v1/admin/personas/buscar', body: '{"correo":"ana@acme.com"}' });
  });

  test('la lista: pide con el filtro de empresa y el cursor, y trae cada persona con su empresa y su estado traducido', async () => {
    const { api, seen } = apiAnswering(() => Response.json({
      personas: [{ correo: 'bea@otra.com', empresa: { id: 'otra-000002', nombre: 'Otra' }, rol: null, admin: true, estado: 'invitado', invitadoEl: 'a', aceptadoEl: null }],
      siguiente: 'c2', soloAlgunas: true,
    }));
    const r = await api.listClientUsers('token-ana', { company: 'acme', cursor: 'c1' });
    expect(seen).toEqual([{ method: 'GET', url: 'https://api.example/v1/admin/personas?empresa=acme&cursor=c1', body: null, authorization: 'Bearer token-ana' }]);
    expect(r).toEqual({ kind: 'ok', value: {
      people: [{ email: 'bea@otra.com', company: { id: 'otra-000002', name: 'Otra' }, role: null, isAdmin: true, status: 'invited', invitedAt: 'a', acceptedAt: null }],
      next: 'c2',
      onlySome: true,
    } });
  });

  test('la búsqueda que encuentra: la empresa y la ficha del asiento, con el estado traducido', async () => {
    const { api } = apiAnswering(() => Response.json({
      encontrada: true, empresa: { id: 'acme-000001', nombre: 'Acme' },
      persona: { correo: 'beto@acme.com', rol: 'ventas', admin: false, estado: 'en-pausa', invitadoEl: 'a', aceptadoEl: null }, soloAlgunas: false,
    }));
    expect(await api.findPerson('t', 'beto@acme.com')).toEqual({ kind: 'ok', value: {
      found: true, company: { id: 'acme-000001', name: 'Acme' }, onlySome: false,
      seat: { email: 'beto@acme.com', role: 'ventas', isAdmin: false, status: 'paused', invitedAt: 'a', acceptedAt: null },
    } });
  });

  test('las personas de una empresa: lo que ve cada una y la empresa a la que pertenecen', async () => {
    const { api } = apiAnswering(() => Response.json({
      cliente: { id: 'acme-000001', nombre: 'Acme' },
      empresa: { dominios: [{ slug: 'convert', skills: ['copy'] }], cuenta: { skills: 1, agentes: 0, cadenas: 0 } },
      roles: [{ slug: 'ventas', label: 'Ventas', base: 'nada', vacio: false, reglas: [{}, {}], personas: 1 }],
      personas: [{ correo: 'beto@acme.com', rol: 'ventas', admin: false, estado: 'activo', ve: { tipo: 'rol', rol: 'ventas', ajustes: 1 }, cuenta: { skills: 1, agentes: 0, cadenas: 0 }, invitadoEl: 'a', aceptadoEl: null }],
      revocadas: [{ correo: 'dani@acme.com', revocadoEl: 'b' }],
      bitacora: [{ accion: 'invito', actor: 'ana@acme.com', sobre: 'beto@acme.com', cuando: 'c' }],
    }));
    const r = await api.getCompanyPeople('t', 'acme-000001');
    expect(r.kind === 'ok' && r.value.company).toEqual({ id: 'acme-000001', name: 'Acme' });
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
  test('la auditoría: pide con el objetivo y el cursor, y traduce cada evento', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ eventos: [
      { fecha: 'f', actor: 'equipo:jose', canal: 'api', operacion: 'equipo.alta', objetivo: 'equipo#nati', motivo: 'm', antes: null, despues: null },
    ], siguiente: null, soloAlgunas: true }));
    const r = await api.listAuditEvents('t', { target: 'equipo#nati', cursor: 'c1' });
    expect(seen[0]?.url).toBe('https://api.example/v1/admin/auditoria?objetivo=equipo%23nati&cursor=c1');
    expect(r).toEqual({ kind: 'ok', value: { events: [{ at: 'f', actor: 'equipo:jose', channel: 'api', operation: 'equipo.alta', target: 'equipo#nati', reason: 'm', before: null, after: null }], next: null, onlySome: true } });
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
