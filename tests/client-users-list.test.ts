// La lista de Usuarios de clientes, desde el panel (CA-33 de M2a; spec «Paginación numerada», CA-8).
//
// EL DEFECTO QUE PREVIENE. Si el loader no le pasara la página de la dirección al backend, cada
// número de la paginación mostraría la primera página y soporte creería que la lista termina ahí. Y si
// buscar recargara la lista, un fallo de la lista taparía el resultado de la búsqueda.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const listClientUsers = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ listClientUsers }) }));
const { loader, shouldRevalidate } = await import('../app/modules/client-users/routes/client-users');
const { emptyListMessage } = await import('../app/modules/client-users/client-user-labels');
const { clientUsersHref } = await import('../app/modules/client-users/client-users-href');

const EMPTY_PAGE = { page: 1, pages: 1, total: 0, perPage: 50 };

function open(url: string) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  return loader({ request: new Request(url), context, params: {} } as never);
}

beforeEach(() => {
  listClientUsers.mockReset();
  listClientUsers.mockResolvedValue({ kind: 'ok', value: { people: [], page: EMPTY_PAGE, companies: [], onlySome: true } });
});

describe('la lista de personas', () => {
  test('la primera página se pide sin filtro, con el token de la sesión', async () => {
    expect(await open('https://dxxxx.cloudfront.net/client-users')).toEqual({ people: [], page: EMPTY_PAGE, companies: [], onlySome: true });
    expect(listClientUsers).toHaveBeenCalledWith('token-ana', { company: '', kind: null, page: 1 });
  });

  test('«Solo cuentas personales» pide solo esas personas, y nunca junto con una empresa', async () => {
    await open('https://dxxxx.cloudfront.net/client-users?kind=personal&company=acme&page=2');
    expect(listClientUsers).toHaveBeenCalledWith('token-ana', { company: '', kind: 'personal', page: 2 });
  });

  test('⛔ un número de página pide esa página, con el mismo filtro de empresa; un cursor viejo, la primera', async () => {
    await open('https://dxxxx.cloudfront.net/client-users?company=acme&page=4');
    expect(listClientUsers).toHaveBeenCalledWith('token-ana', { company: 'acme', kind: null, page: 4 });
    await open('https://dxxxx.cloudfront.net/client-users?company=acme&cursor=c2');
    expect(listClientUsers).toHaveBeenLastCalledWith('token-ana', { company: 'acme', kind: null, page: 1 });
  });

  test('⛔ CA-8 · elegir otra empresa vuelve a la primera página, y los números conservan lo elegido', () => {
    expect(clientUsersHref({ kind: 'company', id: 'acme' })).toBe('?company=acme');
    expect(clientUsersHref({ kind: 'company', id: 'acme' }, 2)).toBe('?company=acme&page=2');
    expect([clientUsersHref({ kind: 'personal' }, 4), clientUsersHref({ kind: 'all' })]).toEqual(['?kind=personal&page=4', '?']);
  });

  test('sin nadie, la lista dice por qué: la empresa elegida, una que no está o que no hay personas', () => {
    expect(emptyListMessage({ kind: 'company', name: 'Auteco' }, EMPTY_PAGE)).toBe('Auteco no tiene personas activas, invitadas ni en pausa.');
    expect(emptyListMessage({ kind: 'unknown-company' }, EMPTY_PAGE)).toMatch(/no está entre las que el panel muestra/);
    expect(emptyListMessage({ kind: 'all' }, EMPTY_PAGE)).toMatch(/Todavía no hay personas/);
    expect(emptyListMessage({ kind: 'personal' }, EMPTY_PAGE)).toMatch(/Ninguna cuenta personal tiene personas/);
  });

  test('⛔ una página vacía de una lista con total no dice que la empresa no tiene a nadie: sus entradas no tienen asiento', () => {
    // 50 vigentes y una entrada del índice sin asiento: la página 2 llega vacía y el paginador dice «51–51 de 51».
    const secondOfTwo = { page: 2, pages: 2, total: 51, perPage: 50 };
    expect(emptyListMessage({ kind: 'company', name: 'Acme' }, secondOfTwo)).toMatch(/^En esta página no quedan personas vigentes/);
  });

  // Si buscar volviera a pedir la lista, cada búsqueda costaría un pedido más, y un fallo de la
  // lista taparía con la página de error el resultado que sí llegó.
  test('buscar por correo no vuelve a pedir la lista; cambiar de página sí', () => {
    const args = (formMethod: string | undefined) => ({ formMethod, defaultShouldRevalidate: true }) as never;
    expect([shouldRevalidate(args('POST')), shouldRevalidate(args(undefined))]).toEqual([false, true]);
  });
});
