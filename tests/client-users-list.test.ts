// La lista de Usuarios de clientes, desde el panel (CA-33 de M2a).
//
// EL DEFECTO QUE PREVIENE. Si el loader no le pasara el cursor de la dirección al backend,
// «Siguiente» mostraría siempre la primera página y soporte creería que la lista termina ahí. Y si
// buscar recargara la lista, un fallo de la lista taparía el resultado de la búsqueda.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const listClientUsers = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listClientUsers }) }));
const { loader, shouldRevalidate } = await import('../app/modules/client-users/routes/client-users');
const { emptyListMessage } = await import('../app/modules/client-users/client-user-labels');

function open(url: string) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  return loader({ request: new Request(url), context, params: {} } as never);
}

beforeEach(() => {
  listClientUsers.mockReset();
  listClientUsers.mockResolvedValue({ kind: 'ok', value: { people: [], next: null, companies: [], onlySome: true } });
});

describe('la lista de personas', () => {
  test('la primera página se pide sin cursor ni filtro, con el token de la sesión', async () => {
    expect(await open('https://dxxxx.cloudfront.net/client-users')).toEqual({ people: [], next: null, companies: [], onlySome: true });
    expect(listClientUsers).toHaveBeenCalledWith('token-ana', { company: '', cursor: null });
  });

  test('⛔ «Siguiente» pide la página del cursor que trae la dirección, con el mismo filtro de empresa', async () => {
    await open('https://dxxxx.cloudfront.net/client-users?company=acme&cursor=c2');
    expect(listClientUsers).toHaveBeenCalledWith('token-ana', { company: 'acme', cursor: 'c2' });
  });

  test('sin nadie, la lista dice por qué: la empresa elegida, una que no está, una página que se vació o que no hay personas', () => {
    expect(emptyListMessage({ kind: 'company', name: 'Auteco' }, false)).toBe('Auteco no tiene personas activas, invitadas ni en pausa.');
    expect(emptyListMessage({ kind: 'unknown-company' }, false)).toMatch(/no está entre las que el panel muestra/);
    expect(emptyListMessage({ kind: 'company', name: 'Auteco' }, true)).toMatch(/En esta página/);
    expect(emptyListMessage({ kind: 'all' }, false)).toMatch(/Todavía no hay personas/);
  });

  // Si buscar volviera a pedir la lista, cada búsqueda costaría un pedido más, y un fallo de la
  // lista taparía con la página de error el resultado que sí llegó.
  test('buscar por correo no vuelve a pedir la lista; cambiar de página sí', () => {
    const args = (formMethod: string | undefined) => ({ formMethod, defaultShouldRevalidate: true }) as never;
    expect([shouldRevalidate(args('POST')), shouldRevalidate(args(undefined))]).toEqual([false, true]);
  });
});
