// El cliente de `/v1/admin/yo` y su traducción al idioma del panel (CA-30).
//
// EL DEFECTO QUE PREVIENE. Si el nombre de un módulo se tradujera mal, la persona perdería un
// módulo que sí tiene o —peor— ganaría uno que no. Si un módulo nuevo del backend rompiera la
// página, un despliegue del backend tumbaría el panel. Y si un 403 del backend se tomara como
// «sin permisos todavía», una persona suspendida seguiría adentro.
import { describe, expect, test } from 'vitest';
import { AdminApiUnavailableError, createAdminApi } from '../app/shared/api/admin-api.server';
import { TeamMemberContractError, toApiPermissions, toTeamMember } from '../app/shared/api/team-member-mapping';

const API_BODY = {
  actor: 'equipo:sub-ana',
  correo: 'ana@beenso.com',
  nombre: 'Ana',
  superadmin: false,
  estado: 'activa',
  permisos: { empresas: 'ver', 'documentos-texto': 'ver' },
};

function collectLog() {
  const lines: string[] = [];
  return { lines, log: (line: string) => lines.push(line) };
}

describe('toTeamMember', () => {
  test('traduce la respuesta del backend al idioma del panel', () => {
    expect(toTeamMember(API_BODY, collectLog().log)).toEqual({
      actor: 'equipo:sub-ana',
      email: 'ana@beenso.com',
      name: 'Ana',
      isSuperadmin: false,
      status: 'active',
      permissions: { companies: 'view', documentText: 'view' },
    });
  });

  test('cada módulo y nivel del backend tiene su traducción', () => {
    const permisos = {
      'vista-general': 'ver', empresas: 'editar', entrevistas: 'editar', documentos: 'editar', 'documentos-texto': 'ver',
      skills: 'editar', usuarios: 'editar', consumo: 'editar', gobernanza: 'ver', upsell: 'editar',
    };
    const { lines, log } = collectLog();
    const member = toTeamMember({ ...API_BODY, permisos }, log);
    expect(Object.keys(member.permissions)).toHaveLength(10);
    expect(lines).toEqual([]);
  });

  test('un módulo o un nivel desconocido se descarta y queda en el log, sin romper', () => {
    const { lines, log } = collectLog();
    const permisos = JSON.parse('{"empresas":"ver","facturas":"ver","consumo":"borrar","documentos-texto":"editar","__proto__":"ver"}');
    const member = toTeamMember({ ...API_BODY, permisos }, log);
    expect(member.permissions).toEqual({ companies: 'view' });
    expect(Object.getPrototypeOf(member.permissions)).toBe(Object.prototype);
    expect(lines).toHaveLength(4);
    expect(lines.join('\n')).toContain('facturas');
  });

  test('⛔ cualquier estado que no sea «activa» queda inactivo', () => {
    const { lines, log } = collectLog();
    expect(toTeamMember({ ...API_BODY, estado: 'suspendida' }, log).status).toBe('inactive');
    expect(toTeamMember({ ...API_BODY, estado: 'pausada' }, log).status).toBe('inactive');
    expect(lines).toHaveLength(1);
  });

  test('⛔ una respuesta sin la forma de /yo lanza: el contrato con el backend se rompió', () => {
    for (const body of [null, 'ok', { ...API_BODY, actor: undefined }, { ...API_BODY, permisos: ['empresas'] }]) {
      expect(() => toTeamMember(body, collectLog().log), JSON.stringify(body)).toThrow(TeamMemberContractError);
    }
  });
});

describe('toApiPermissions', () => {
  test('lo que el panel manda vuelve igual al pasar por la traducción de ida', () => {
    const permissions = { overview: 'view', companies: 'edit', documentText: 'view', clientUsers: 'edit', usage: 'view' } as const;
    const api = toApiPermissions(permissions);
    expect(api).toEqual({ 'vista-general': 'ver', empresas: 'editar', 'documentos-texto': 'ver', usuarios: 'editar', consumo: 'ver' });
    expect(toTeamMember({ ...API_BODY, permisos: api }, collectLog().log).permissions).toEqual(permissions);
  });
});

describe('createAdminApi', () => {
  function apiAnswering(response: () => Response) {
    const seen: { url: string; authorization: string | null }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
      return response();
    }) as typeof fetch;
    return { api: createAdminApi({ baseUrl: 'https://api.example', fetchImpl, log: () => {} }), seen };
  }

  test('pide /v1/admin/yo con el access token de la sesión y traduce la respuesta', async () => {
    const { api, seen } = apiAnswering(() => Response.json(API_BODY));
    const result = await api.me('token-de-ana');
    expect(seen).toEqual([{ url: 'https://api.example/v1/admin/yo', authorization: 'Bearer token-de-ana' }]);
    expect(result.kind === 'member' && result.member.permissions).toEqual({ companies: 'view', documentText: 'view' });
  });

  test('⛔ un 401 o un 403 del backend son un rechazo de la persona', async () => {
    for (const status of [401, 403] as const) {
      const { api } = apiAnswering(() => Response.json({ error: 'x' }, { status }));
      expect(await api.me('t')).toEqual({ kind: 'rejected', status });
    }
  });

  test('un error del backend o de la red no es un rechazo: la sesión sigue', async () => {
    const { api } = apiAnswering(() => new Response('caído', { status: 502 }));
    await expect(api.me('t')).rejects.toThrow(AdminApiUnavailableError);
    const offline = createAdminApi({ baseUrl: 'https://api.example', fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch });
    await expect(offline.me('t')).rejects.toThrow(AdminApiUnavailableError);
  });
});
