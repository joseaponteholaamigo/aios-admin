// La traducción de los créditos entre el panel y el backend (spec «Créditos por persona» de aios-tower).
// El cambio de asientos ahora es parte de «Cambiar plan»: lo prueba `tests/change-plan.test.ts`.
//
// EL DEFECTO QUE PREVIENE. Un nombre de campo mal traducido muestra cero créditos o una fecha vacía;
// un correo en la URL queda en los registros de acceso; un rechazo sin traducir rompe el formulario.
import { describe, expect, test } from 'vitest';
import { createAdminReadApi } from '../app/shared/api/admin-read-api.server';
import { createAdminWriteApi } from '../app/shared/api/admin-write-api.server';

type Seen = { url: string; method: string; body: unknown };

function fetchAnswering(respond: () => Response) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : null });
    return respond();
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

const SALDO = {
  tenantId: 'acme-1a2b3c', correo: 'luis@acme.com', acceso: 'con-plan', saldo: 3700, reservado: 0,
  mes: { creditos: 1000, saldo: 200, renueva: '2026-12-01T00:00:00Z' },
  lotes: [{ id: 'lot_1', origen: 'carga', nombre: 'Carga de ENSŌ', creditos: 3500, saldo: 3500, acreditado: '2026-11-10T15:00:00Z', vence: '2026-12-10T15:00:00Z' }],
  movimientos: [{ id: 'res_1', tipo: 'gasto', fecha: '2026-11-12T10:00:00Z', concepto: 'contactos.buscar', estado: 'liquidada', reservado: 150, cobrado: 90 }],
};

const FILA = {
  id: 'res_1', tipo: 'gasto', fecha: '2026-11-12T10:00:00Z', empresa: { id: 'acme-1a2b3c', nombre: 'Acme' }, correo: 'luis@acme.com',
  modulo: 'contactos', concepto: 'contactos.buscar', estado: 'cobrado', reservado: 150, cobrado: 90, devuelto: 60, descartado: 0,
  detalle: { cantidad: 50 }, resultado: { personas: 30 }, de: [{ fuente: 'mes', mes: '2026-11', creditos: 150 }],
};

describe('las lecturas', () => {
  test('⛔ el saldo de una persona se pide por POST con el correo en el cuerpo, y llega en los nombres del panel', async () => {
    const { fetchImpl, seen } = fetchAnswering(() => Response.json(SALDO));
    const r = await createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }).getPersonCredits('t', 'acme-1a2b3c', 'luis@acme.com');
    expect(seen[0]).toEqual({ url: 'https://api.example/v1/admin/clientes/acme-1a2b3c/saldo', method: 'POST', body: { correo: 'luis@acme.com' } });
    expect(r.kind === 'ok' && r.value).toMatchObject({
      access: 'with-plan', available: 3700, month: { credits: 1000, balance: 200, renewsAt: '2026-12-01T00:00:00Z' },
      lots: [{ origin: 'load', name: 'Carga de ENSŌ', balance: 3500, expiresAt: '2026-12-10T15:00:00Z' }],
      movements: [{ kind: 'spend', status: 'charged', reserved: 150, charged: 90 }],
    });
  });

  test('⛔ la bitácora manda solo los filtros puestos, en sus nombres, y nunca en la URL', async () => {
    const { fetchImpl, seen } = fetchAnswering(() => Response.json({ filas: [FILA], paginacion: { pagina: 2, paginas: 3, total: 120, porPagina: 50 } }));
    const api = createAdminReadApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} });
    const r = await api.listCreditLog('t', { company: 'acme-1a2b3c', email: 'luis@acme.com', module: 'contacts', kind: 'spend', from: '2026-11-01', to: '2026-11-30', page: 2 });
    expect(seen[0]).toEqual({
      url: 'https://api.example/v1/admin/creditos/bitacora', method: 'POST',
      body: { empresa: 'acme-1a2b3c', correo: 'luis@acme.com', modulo: 'contactos', tipo: 'gasto', desde: '2026-11-01', hasta: '2026-11-30', pagina: 2 },
    });
    await api.listCreditLog('t', { company: null, email: null, module: null, kind: null, from: null, to: null, page: 1 });
    expect(seen[1]?.body).toEqual({});
    expect(r.kind === 'ok' && r.value.rows[0]).toMatchObject({
      kind: 'spend', company: { id: 'acme-1a2b3c', name: 'Acme' }, module: 'contacts', status: 'charged', reserved: 150, charged: 90,
      result: { personas: 30 }, sources: [{ kind: 'month', month: '2026-11', credits: 150 }],
    });
    expect(r.kind === 'ok' && r.value.page).toEqual({ page: 2, pages: 3, total: 120, perPage: 50 });
  });
});

describe('las escrituras', () => {
  test('⛔ la carga lleva el correo y la clave en el cuerpo, y devuelve cuánto se cargó y cuándo vence', async () => {
    const lote = { id: 'lot_1', origen: 'carga', nombre: 'Carga de ENSŌ', creditos: 11000, saldo: 11000, acreditado: '2026-11-12T14:00:00Z', vence: '2026-12-12T14:00:00Z' };
    const { fetchImpl, seen } = fetchAnswering(() => Response.json({ tenantId: 'acme-1a2b3c', correo: 'luis@acme.com', lote }, { status: 201 }));
    const r = await createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} })
      .loadCredits('t', 'acme-1a2b3c', { email: 'luis@acme.com', credits: 11000, reason: 'Factura 1234', key: 'carga-0001' });
    expect(seen[0]).toEqual({
      url: 'https://api.example/v1/admin/clientes/acme-1a2b3c/creditos', method: 'POST',
      body: { correo: 'luis@acme.com', creditos: 11000, motivo: 'Factura 1234', clave: 'carga-0001' },
    });
    expect(r).toEqual({ kind: 'ok', value: { credits: 11000, expiresAt: '2026-12-12T14:00:00Z' } });
  });

  test('otra operación con los créditos de la misma persona llega como rechazo, para volver a intentar', async () => {
    const { fetchImpl } = fetchAnswering(() => Response.json({ error: 'no', codigo: 'ocupado' }, { status: 503 }));
    const r = await createAdminWriteApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} })
      .loadCredits('t', 'x-1', { email: 'luis@acme.com', credits: 10, reason: '', key: 'carga-0001' });
    expect(r).toEqual({ kind: 'rejected', rejection: { code: 'busy' }, createdAccountId: null });
  });
});
