// Las escrituras del panel en la API de admin (spec «Crear empresas e invitar personas»): qué pide
// en los nombres del backend y cómo lee cada respuesta.
//
// EL DEFECTO QUE PREVIENE. Si un rechazo (409, 422) se leyera como «la API no responde», el formulario
// mostraría una página de error en vez de decir que el correo ya es de otra empresa. Si el 401 del MFA
// se leyera como sesión vencida, el panel cerraría la sesión en vez de pedir el código. Y si un campo
// llegara con otro nombre, el backend lo rechazaría siempre.
import { describe, expect, test } from 'vitest';
import type { NewAccount } from '../app/domain/account-creation';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { ApiContractError } from '../app/shared/api/api-reading';

type Seen = { url: string; body: unknown };

function apiAnswering(respond: () => Response) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: JSON.parse(String(init.body)) });
    return respond();
  }) as unknown as typeof fetch;
  return { api: createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), seen };
}

const ACCOUNT: NewAccount = {
  kind: 'company', name: 'Acme', plan: 'custom', adminEmail: 'ana@acme.com', key: 'clave-de-prueba-0001', moveFromPersonal: false,
  conditions: { content: 'all', seats: 3, team: true, schedules: true, endsOn: null, quotas: { radar: 5, projects: null, chains: 0 } },
};

const CUENTA = {
  id: 'acme-1a2b3c', nombre: 'Acme', tipo: 'empresa', plan: 'personalizado', estado: 'active', vencimiento: { vencido: false, vencidoPor: null, hasta: null },
  aviso: null, asientos: { usados: 1, tope: 3 }, admins: 1, pagaPorStripe: false, creadaEl: '2026-11-04T00:00:00Z',
};

describe('crear una cuenta', () => {
  test('pide en los nombres del backend; mover viaja solo si se pidió', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ cuenta: CUENTA, correoDeInvitacion: 'enviado' }, { status: 201 }));
    await api.createAccount('t', ACCOUNT);
    await api.createAccount('t', { ...ACCOUNT, moveFromPersonal: true });
    expect(seen[0]).toEqual({
      url: 'https://api.example/v1/admin/clientes',
      body: {
        nombre: 'Acme', tipo: 'empresa', plan: 'personalizado', admin: 'ana@acme.com', clave: 'clave-de-prueba-0001',
        condiciones: { contenido: 'todo', asientos: 3, equipo: true, horarios: true, hasta: null, cupos: { radar: 5, proyectos: null, cadenas: 0 } },
      },
    });
    expect((seen[1]?.body as Record<string, unknown>).moverDesdeCuentaPersonal).toBe(true);
  });

  test('una cuenta creada trae la cuenta en la forma de la lista y si salió la invitación', async () => {
    const { api } = apiAnswering(() => Response.json({ cuenta: CUENTA, correoDeInvitacion: 'no-enviado', movidaDesde: 'webinar-c1-0000a1' }, { status: 201 }));
    const r = await api.createAccount('t', ACCOUNT);
    expect(r.kind === 'ok' && [r.value.company.id, r.value.invitationSent, r.value.movedFrom]).toEqual(['acme-1a2b3c', false, 'webinar-c1-0000a1']);
  });

  test('⛔ un rechazo vuelve al formulario con lo que hace falta para mostrarlo', async () => {
    const casos: [number, object, object][] = [
      [409, { codigo: 'correo-de-otra-empresa', empresa: { id: 'otra-1', nombre: 'Otra' } }, { code: 'email-in-other-company', company: { id: 'otra-1', name: 'Otra' } }],
      [409, { codigo: 'correo-en-cuenta-personal', cuenta: { id: 'web-1', nombre: 'W', pagaPorStripe: false } }, { code: 'email-in-personal-account', account: { id: 'web-1', name: 'W', paysWithStripe: false } }],
      [422, { codigo: 'plan-rechazado', rechazos: ['«asientos» tiene que ser…'] }, { code: 'plan-rejected', rejections: ['«asientos» tiene que ser…'] }],
      [401, { codigo: 'mfa-reciente' }, { code: 'recent-mfa' }],
      [503, { codigo: 'mover-incompleto' }, { code: 'move-incomplete' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { api } = apiAnswering(() => Response.json(body, { status }));
      expect(await api.createAccount('t', ACCOUNT)).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });

  test('un rechazo de una creación que ya creó la cuenta trae su id, para que el formulario la nombre', async () => {
    const { api } = apiAnswering(() => Response.json({ codigo: 'mover-incompleto', cuentaCreada: 'acme-1a2b3c' }, { status: 503 }));
    expect(await api.createAccount('t', ACCOUNT)).toEqual({ kind: 'rejected', rejection: { code: 'move-incomplete' }, createdAccountId: 'acme-1a2b3c' });
  });

  test('⛔ un 401 sin código es la sesión vencida, no un rechazo; un 403, sin permiso', async () => {
    expect(await apiAnswering(() => new Response('Unauthorized', { status: 401 })).api.createAccount('t', ACCOUNT)).toEqual({ kind: 'unauthorized' });
    expect(await apiAnswering(() => Response.json({ error: 'no' }, { status: 403 })).api.createAccount('t', ACCOUNT)).toEqual({ kind: 'forbidden' });
  });

  test('un 500, o un rechazo con un código que el panel no conoce, no se maquilla de rechazo', async () => {
    await expect(apiAnswering(() => Response.json({}, { status: 500 })).api.createAccount('t', ACCOUNT)).rejects.toBeInstanceOf(AdminApiUnavailableError);
    await expect(apiAnswering(() => Response.json({ codigo: 'otro-codigo' }, { status: 409 })).api.createAccount('t', ACCOUNT)).rejects.toBeInstanceOf(AdminApiUnavailableError);
    await expect(apiAnswering(() => Response.json({ correoDeInvitacion: 'enviado' }, { status: 201 })).api.createAccount('t', ACCOUNT)).rejects.toBeInstanceOf(ApiContractError);
  });
});

describe('invitar a una persona', () => {
  test('pide a la cuenta de la ruta, en los nombres del backend', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ asiento: {}, correoDeInvitacion: 'enviado' }, { status: 201 }));
    const r = await api.invitePerson('t', 'acme-1a2b3c', { email: 'beto@acme.com', isAdmin: false, role: 'ventas', reason: 'lo pidió', moveFromPersonal: false });
    expect(seen[0]).toEqual({ url: 'https://api.example/v1/admin/clientes/acme-1a2b3c/personas', body: { correo: 'beto@acme.com', admin: false, rol: 'ventas', motivo: 'lo pidió' } });
    expect(r).toEqual({ kind: 'ok', value: { invitationSent: true, movedFrom: null } });
  });

  // EL DEFECTO: con el tope diario de invitaciones de la cuenta lleno, el backend responde 429
  // `tope-diario`. Leído como «la API no responde», el equipo vería una página de error y volvería a
  // intentar sin saber que hasta el día siguiente no sale ninguna invitación.
  test('⛔ el tope diario de invitaciones vuelve al formulario con desde cuándo reintentar', async () => {
    const { api } = apiAnswering(() => Response.json({ codigo: 'tope-diario', reintentarEl: '2026-11-10T00:00:00.000Z' }, { status: 429 }));
    const r = await api.invitePerson('t', 'acme-1a2b3c', { email: 'beto@acme.com', isAdmin: false, role: null, reason: 'lo pidió', moveFromPersonal: false });
    expect(r).toEqual({ kind: 'rejected', rejection: { code: 'daily-invite-cap', retryAt: '2026-11-10T00:00:00.000Z' }, createdAccountId: null });
  });

  test('un 429 sin código, como el freno de API Gateway, sigue siendo «la API no responde»', async () => {
    const { api } = apiAnswering(() => Response.json({ message: 'Too Many Requests' }, { status: 429 }));
    await expect(api.invitePerson('t', 'acme-1a2b3c', { email: 'beto@acme.com', isAdmin: false, role: null, reason: 'lo pidió', moveFromPersonal: false }))
      .rejects.toBeInstanceOf(AdminApiUnavailableError);
  });
});

describe('una acción sobre una persona', () => {
  const BETO = { action: 'reset-mfa' as const, email: 'beto@acme.com' };

  test('⛔ pide la acción en la ruta y el correo en el cuerpo: la dirección nunca lleva un @ (CA-8)', async () => {
    const { api, seen } = apiAnswering(() => Response.json({ accion: 'restablecer-mfa', estado: { appDesvinculada: true, sesionesCerradas: true }, correoDeAviso: 'enviado' }));
    await api.personAction('t', 'acme-1a2b3c', BETO);
    await api.personAction('t', 'acme-1a2b3c', { action: 'delete-person', email: 'beto@acme.com' });

    expect(seen.map((s) => s.url)).toEqual([
      'https://api.example/v1/admin/clientes/acme-1a2b3c/personas/restablecer-mfa',
      'https://api.example/v1/admin/clientes/acme-1a2b3c/personas/borrar',
    ]);
    expect(seen[0]?.body).toEqual({ correo: 'beto@acme.com' });
    expect(seen.some((s) => s.url.includes('@'))).toBe(false);
  });

  test('lee si se desvinculó la app y si salió el aviso; sin aviso, `null`', async () => {
    const conAviso = apiAnswering(() => Response.json({ estado: { appDesvinculada: true }, correoDeAviso: 'no-enviado' })).api;
    const sinAviso = apiAnswering(() => Response.json({ estado: { loginBorrado: true, asientoBorrado: true } })).api;

    expect(await conAviso.personAction('t', 'acme-1a2b3c', BETO)).toEqual({ kind: 'ok', value: { action: 'reset-mfa', appUnlinked: true, noticeEmail: 'not-sent' } });
    expect(await sinAviso.personAction('t', 'acme-1a2b3c', { action: 'delete-person', email: 'beto@acme.com' }))
      .toEqual({ kind: 'ok', value: { action: 'delete-person', appUnlinked: null, noticeEmail: null } });
  });

  test('⛔ cada rechazo de una acción vuelve al diálogo, también los 503 que se terminan repitiendo (CA-12)', async () => {
    const casos: [number, object, object][] = [
      [409, { codigo: 'sin-login', asiento: 'activo' }, { code: 'no-login', seat: 'active' }],
      [409, { codigo: 'ultimo-admin' }, { code: 'last-admin' }],
      [409, { codigo: 'correo-de-otra-empresa', empresa: null }, { code: 'email-in-other-company', company: null }],
      [503, { codigo: 'accion-incompleta' }, { code: 'action-incomplete' }],
      [503, { codigo: 'borrar-incompleto' }, { code: 'delete-incomplete' }],
      [401, { codigo: 'mfa-reciente' }, { code: 'recent-mfa' }],
      [404, { codigo: 'no-existe' }, { code: 'not-found' }],
    ];
    for (const [status, body, rejection] of casos) {
      const { api } = apiAnswering(() => Response.json(body, { status }));
      expect(await api.personAction('t', 'acme-1a2b3c', BETO)).toEqual({ kind: 'rejected', rejection, createdAccountId: null });
    }
  });
});
