// La búsqueda de una persona por su correo, desde el panel (CA-23 de M2a).
//
// EL DEFECTO QUE PREVIENE. Lo que se escribe a mano viene con mayúsculas y espacios: si el panel lo
// mandara así, no encontraría a nadie y soporte creería que la persona no existe. Y algo que no es
// un correo no tiene que llegar al backend, que respondería 422 y la pantalla un error genérico.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const findPerson = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ findPerson }) }));
const { action } = await import('../app/modules/client-users/routes/client-users');

function search(email: string) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  const request = new Request('https://dxxxx.cloudfront.net/client-users', { method: 'POST', body: new URLSearchParams({ email }) });
  return action({ request, context, params: {} } as never);
}

beforeEach(() => {
  findPerson.mockReset();
  findPerson.mockResolvedValue({ kind: 'ok', value: { found: false, onlySome: true } });
});

describe('buscar por correo', () => {
  test('manda el correo sin espacios y en minúsculas, con el token de la sesión', async () => {
    const r = await search('  Ana@ACME.com ');
    expect(findPerson).toHaveBeenCalledWith('token-ana', 'ana@acme.com');
    expect(r).toEqual({ error: null, result: { found: false, onlySome: true }, email: 'ana@acme.com' });
  });

  test('⛔ deja buscar los correos raros que el backend sí guarda: la regla es la suya, no la de z.email()', async () => {
    for (const raro of ['josé@acme.com', 'a..b@acme.com', 'ana@acme.c', 'a&b@acme.com']) {
      expect((await search(raro)).error, raro).toBeNull();
    }
    expect(findPerson).toHaveBeenCalledTimes(4);
  });

  test('⛔ algo que no es un correo no llega al backend: la pantalla pide uno completo', async () => {
    for (const malo of ['', 'ana', 'ana@', '@acme.com']) {
      const r = await search(malo);
      expect(r.error, malo).toMatch(/correo completo/);
    }
    expect(findPerson).not.toHaveBeenCalled();
  });
});
