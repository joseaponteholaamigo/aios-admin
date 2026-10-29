// La búsqueda por correo de Usuarios de clientes, desde el panel (CA-11 y CA-23 de M2a).
//
// EL DEFECTO QUE PREVIENE. Lo que se escribe a mano viene con mayúsculas y espacios: si el panel lo
// mandara así, no encontraría a nadie y soporte creería que la persona no existe. Si la respuesta no
// dijera qué texto y qué empresa buscó, la pantalla mostraría el resultado de una búsqueda vieja
// como si fuera el de la nueva. Y lo que no se puede buscar no tiene que llegar al backend.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { sessionContext } from '../app/middleware/session.server';
import type { ActiveSession } from '../app/shared/session/session.server';

const searchPeople = vi.fn();
vi.mock('../app/shared/api/admin-read-api-service.server', () => ({ getAdminReadApi: () => ({ searchPeople }) }));
const { action } = await import('../app/modules/client-users/routes/client-users');

const FOUND = { people: [], hasMore: false, onlySome: true };

function search(text: string, company = '') {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  const request = new Request('https://dxxxx.cloudfront.net/client-users', { method: 'POST', body: new URLSearchParams({ text, company }) });
  return action({ request, context, params: {} } as never);
}

beforeEach(() => {
  searchPeople.mockReset();
  searchPeople.mockResolvedValue({ kind: 'ok', value: FOUND });
});

describe('buscar por correo', () => {
  test('manda el texto sin espacios y en minúsculas, con la empresa elegida y el token de la sesión', async () => {
    const r = await search('  Ana@ACME ', 'acme-000001');
    expect(searchPeople).toHaveBeenCalledWith('token-ana', { text: 'ana@acme', company: 'acme-000001' });
    expect(r).toEqual({ text: 'ana@acme', company: 'acme-000001', result: FOUND });
  });

  test('busca con un pedazo del correo: ya no exige uno completo', async () => {
    for (const pedazo of ['ana', '@acme', 'josé']) await search(pedazo);
    expect(searchPeople).toHaveBeenCalledTimes(3);
  });

  test('⛔ sin texto, o con uno más largo que un correo, no llega al backend y responde que no hay nadie', async () => {
    for (const malo of ['', '   ', 'a'.repeat(255)]) {
      const r = await search(malo);
      expect(r.result, JSON.stringify(malo).slice(0, 20)).toEqual({ people: [], hasMore: false, onlySome: true });
    }
    expect(searchPeople).not.toHaveBeenCalled();
  });
});
