// El middleware de permisos (`app/middleware/permissions.server.ts`, CA-24, CA-25, CB-5, CB-6).
//
// EL DEFECTO QUE PREVIENE. Si cada *loader* pidiera `/yo` por su cuenta, el panel haría varias
// llamadas al backend por página. Si una ruta respondiera sin revisar el nivel, quien solo puede
// ver podría editar. Y si una persona suspendida o con un permiso quitado siguiera entrando,
// la caché sería una puerta trasera: tiene que notarse en 30 s como mucho.
import { describe, expect, test } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { permissionsMiddleware, teamMemberContext } from '../app/middleware/permissions.server';
import { sessionContext } from '../app/middleware/session.server';
import { MEMBER_CACHE_MS, createTeamMemberSource, type TeamMemberSource } from '../app/shared/api/team-member-source.server';
import { AdminApiUnavailableError } from '../app/shared/api/admin-api.server';
import { TeamMemberContractError } from '../app/shared/api/team-member-mapping';
import { menuFor } from '../app/shared/routing/route-access';
import type { RouteEntry } from '../app/shared/routing/route-table';
import type { ActiveSession, SessionService } from '../app/shared/session/session.server';
import { loader as rootLoader } from '../app/root';
import { loader as homeLoader } from '../app/modules/home/routes/home';
import { fakeAdminApi, teamMember } from './helpers/fake-admin-api';
import { runMiddleware } from './helpers/run-middleware';

const TABLE: RouteEntry[] = [
  { path: '', file: 'x', access: 'member', menu: { label: 'Inicio', group: 'administration', icon: 'fleet' } },
  { path: 'companies', file: 'x', access: { module: 'companies', level: 'view' }, menu: { label: 'Empresas', group: 'administration', icon: 'empresas' } },
  { path: 'companies/:id/edit', file: 'x', access: { module: 'companies', level: 'edit' } },
  { path: 'auth/no-access', file: 'x', access: 'public' },
];

const sessionOf = (sub: string) => ({ id: `id-${sub}`, sub, tokens: { accessToken: `token-${sub}` }, record: {} }) as unknown as ActiveSession;

function setup({ unavailable = false } = {}) {
  let clock = 0;
  const fake = fakeAdminApi();
  const source: TeamMemberSource = unavailable
    ? { load: async () => { throw new AdminApiUnavailableError('caído'); } }
    : createTeamMemberSource({ api: fake.api, now: () => clock });
  const destroyed: string[] = [];
  const sessions = {
    destroy: async () => {
      destroyed.push('destroyed');
      return { cookie: '__Host-panel-session=; Max-Age=0', session: null };
    },
  } as unknown as SessionService;
  const logs: string[] = [];
  const middleware = permissionsMiddleware({ members: () => source, sessions: () => sessions, routes: TABLE, log: (l) => logs.push(l) });
  const request = (path: string, sub: string | null = 'ana') => {
    const context = new RouterContextProvider();
    context.set(sessionContext, sub ? sessionOf(sub) : null);
    return runMiddleware(middleware, path, context);
  };
  return { fake, request, destroyed, logs, advance: (ms: number) => { clock += ms; } };
}

const asMember = (sub: string, overrides = {}) => ({ kind: 'member' as const, member: teamMember(sub, overrides) });

describe('permissionsMiddleware', () => {
  test('/yo una sola vez por pedido: la raíz y la página leen la persona del contexto', async () => {
    const { fake, request } = setup();
    fake.answer('token-ana', asMember('ana', { name: 'Ana' }));
    const run = await request('/');
    expect(run.reached).toBe(true);
    const args = { context: run.context, request: new Request('https://dxxxx.cloudfront.net/'), params: {} } as never;
    expect(rootLoader(args).menu).toEqual([{ path: '/', label: 'Inicio', group: 'administration', icon: 'fleet' }]);
    expect(homeLoader(args).name).toBe('Ana');
    expect(fake.calls()).toBe(1);
  });

  test('la caché vive 30 s como mucho', async () => {
    const { fake, request, advance } = setup();
    fake.answer('token-ana', asMember('ana'));
    await request('/');
    advance(MEMBER_CACHE_MS - 1);
    await request('/');
    expect(fake.calls()).toBe(1);
    advance(1);
    await request('/');
    expect(fake.calls()).toBe(2);
  });

  test('⛔ la caché es de cada persona: la segunda no recibe la entrada de la primera', async () => {
    const { fake, request } = setup();
    fake.answer('token-ana', asMember('ana'));
    fake.answer('token-beto', asMember('beto'));
    await request('/', 'ana');
    const beto = await request('/', 'beto');
    expect(beto.context.get(teamMemberContext)?.actor).toBe('equipo:beto');
  });

  test('una ruta pública no pide sesión ni /yo', async () => {
    const { fake, request } = setup();
    const run = await request('/auth/no-access', null);
    expect(run.reached).toBe(true);
    expect(fake.calls()).toBe(0);
  });

  test('⛔ una ruta que no está en la tabla responde 403', async () => {
    const { request } = setup();
    const run = await request('/inventada');
    expect([run.reached, run.thrownStatus]).toEqual([false, 403]);
  });

  test('⛔ sin el nivel que pide la ruta, 403; con él, pasa', async () => {
    const { fake, request } = setup();
    fake.answer('token-ana', asMember('ana', { permissions: { companies: 'view' } }));
    expect((await request('/companies')).reached).toBe(true);
    const edit = await request('/companies/42/edit');
    expect([edit.reached, edit.thrownStatus]).toEqual([false, 403]);
  });

  test('⛔ un permiso quitado deja de servir y sale del menú al vencer la caché (CB-6)', async () => {
    const { fake, request, advance } = setup();
    fake.answer('token-ana', asMember('ana', { permissions: { companies: 'view' } }));
    expect((await request('/companies')).reached).toBe(true);
    fake.answer('token-ana', asMember('ana', { permissions: {} }));
    advance(MEMBER_CACHE_MS);
    expect((await request('/companies')).thrownStatus).toBe(403);
    const home = await request('/');
    expect(menuFor(home.context.get(teamMemberContext)!, TABLE).map((i) => i.label)).toEqual(['Inicio']);
  });

  test('⛔ si el backend rechaza a la persona, borra la sesión y va a «sin acceso» (CB-5)', async () => {
    const { fake, request, advance, destroyed, logs } = setup();
    fake.answer('token-ana', asMember('ana'));
    await request('/');
    fake.answer('token-ana', { kind: 'rejected', status: 403 });
    advance(MEMBER_CACHE_MS);
    const run = await request('/');
    expect(run.reached).toBe(false);
    const response = run.thrown as Response;
    expect(response.headers.get('location')).toBe('/auth/no-access');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(destroyed).toHaveLength(1);
    expect(logs.join('\n')).toContain('403');
  });

  test('si el backend no responde, el error sube y la sesión no se toca', async () => {
    const { request, destroyed } = setup({ unavailable: true });
    expect((await request('/')).thrown).toBeInstanceOf(AdminApiUnavailableError);
    expect(destroyed).toEqual([]);
  });

  test('⛔ una respuesta de /yo por otra persona se rechaza y no se guarda', async () => {
    const { fake, request } = setup();
    fake.answer('token-ana', asMember('beto'));
    expect((await request('/')).thrown).toBeInstanceOf(TeamMemberContractError);
    expect((await request('/')).thrown).toBeInstanceOf(TeamMemberContractError);
    expect(fake.calls()).toBe(2);
  });
});
