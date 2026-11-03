// La lista de Gobernanza desde el panel: el objetivo y la página de la dirección (CA-12 de M2a; spec
// «Paginación numerada», CA-8).
//
// EL DEFECTO QUE PREVIENE. Si el loader no le pasara la página al backend, cada número de la
// paginación mostraría los eventos más nuevos y la auditoría parecería terminar en la primera página.
// Y si un objetivo mal escrito viajara, el backend respondería 422 y la pantalla diría que el enlace
// venció en vez de pedir que se corrija.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const listAuditEvents = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listAuditEvents }) }));
const { loader } = await import('../app/modules/governance/routes/governance');

const EMPTY = { events: [], page: { page: 1, pages: 1, total: 0, perPage: 50 }, onlySome: false };

function open(url: string) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  return loader({ request: new Request(url), context, params: {} } as never);
}

beforeEach(() => {
  listAuditEvents.mockReset();
  listAuditEvents.mockResolvedValue({ kind: 'ok', value: EMPTY });
});

describe('la auditoría', () => {
  test('el objetivo y la página de la dirección llegan al backend', async () => {
    await open(`https://dxxxx.cloudfront.net/governance?target=${encodeURIComponent('equipo#nati')}&page=3`);
    expect(listAuditEvents).toHaveBeenCalledWith('token-ana', { target: 'equipo#nati', page: 3 });
  });

  test('sin página, pide la primera', async () => {
    await open('https://dxxxx.cloudfront.net/governance');
    expect(listAuditEvents).toHaveBeenCalledWith('token-ana', { target: null, page: 1 });
  });

  test('un objetivo mal escrito no viaja: la lista sale vacía y la pantalla pide corregirlo', async () => {
    const data = await open(`https://dxxxx.cloudfront.net/governance?target=${encodeURIComponent("tenant#a' or 1=1")}&page=2`);
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(data).toMatchObject({ events: [], page: { total: 0 }, targetError: true });
  });
});
