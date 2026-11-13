// «Equipo ensō» en el panel (spec «Equipo ENSŌ», CA-14 a CA-22).
//
// EL DEFECTO QUE PREVIENE. Un editor que perdiera los permisos de un módulo sin pantalla al guardar
// le quitaría acceso a alguien sin que nadie lo viera; un adelanto del menú que no saliera de la
// misma regla que el menú mentiría sobre lo que la persona va a ver; una acción que se disparara de
// un clic suspendería o retiraría a alguien por error; un reintento con otra clave daría de alta dos
// veces; y en su propia página, el superadministrador podría quitarse la marca a sí mismo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouterContextProvider, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { teamActionsFor, type TeamPerson } from '../app/domain/team';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { toWriteRejection } from '../app/shared/api/write-mapping';
import { ROUTE_TABLE, type RouteEntry } from '../app/shared/routing/route-table';
import { modulesWithScreen } from '../app/shared/routing/route-access';
import { readNewTeamMember, readPermissionsChange, splitPermissions } from '../app/modules/team/team-form-data';
import { MenuPreview } from '../app/modules/team/components/menu-preview';
import { PermissionsForm } from '../app/modules/team/components/permissions-form';
import { TeamMemberActions } from '../app/modules/team/components/team-member-actions';
import { TeamTable } from '../app/modules/team/components/team-table';

const createTeamMember = vi.fn();
const changeTeamPermissions = vi.fn();
const teamAction = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ createTeamMember, changeTeamPermissions, teamAction }) }));
const { action: crear, default: TeamNew } = await import('../app/modules/team/routes/team-new');
const { action: actuar, default: TeamMemberPage } = await import('../app/modules/team/routes/team-member');

const JOSE: TeamMember = { actor: 'equipo:sub-jose', email: 'jose@beenso.com', name: 'Jose', isSuperadmin: true, status: 'active', permissions: {} };
const NATI: TeamPerson = {
  actor: 'equipo:sub-nati', sub: 'sub-nati', email: 'nati@beenso.com', name: 'Nati', isSuperadmin: false, status: 'active',
  permissions: { companies: 'view', skills: 'edit' }, invitation: 'accepted', version: 'W/"4"',
};
const KEY = 'alta-0001-abcd-efgh';

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function post(url: string, fields: Record<string, string>, route: (args: never) => unknown, params: Record<string, string> = {}) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-jose', tokens: { accessToken: 'token-jose' } } as unknown as ActiveSession);
  context.set(teamMemberContext, JOSE);
  return route({ request: new Request(`https://dxxxx.cloudfront.net${url}`, { method: 'POST', body: formOf(fields) }), context, params } as never);
}

function render(element: ReturnType<typeof createElement>, at = '/team/sub-nati') {
  const Stub = createRoutesStub([{ path: '*', Component: () => element }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [at] }));
}

/** Los `<input>` con ese `name`, enteros (React ordena los atributos a su modo). */
const inputsNamed = (html: string, name: string) => (html.match(/<input[^>]*>/g) ?? []).filter((t) => t.includes(`name="${name}"`));

beforeEach(() => { createTeamMember.mockReset(); changeTeamPermissions.mockReset(); teamAction.mockReset(); });

describe('los módulos del editor (decisión 3)', () => {
  test('⛔ son los que tienen una ruta en la tabla, y uno nuevo aparece solo', () => {
    expect(modulesWithScreen()).toEqual(['companies', 'clientUsers', 'usage', 'governance', 'codes']);
    const conSkills: RouteEntry[] = [...ROUTE_TABLE, { path: 'skills', file: 'x.tsx', access: { module: 'skills', level: 'view' } }];
    expect(modulesWithScreen(conSkills)).toContain('skills');
  });

  test('⛔ lo que tenía en un módulo sin pantalla viaja oculto y no se edita: guardar no se lo quita', () => {
    expect(splitPermissions(NATI.permissions)).toEqual({ shown: { companies: 'view' }, hidden: { skills: 'edit' } });
    const html = render(createElement(PermissionsForm, { person: NATI, reasonError: null, rejection: null }));
    expect(inputsNamed(html, 'perm.skills')).toEqual([expect.stringContaining('type="hidden"')]);
    expect(inputsNamed(html, 'perm.skills')[0]).toContain('value="edit"');
  });

  test('cada fila ofrece solo los niveles que admite su módulo', () => {
    const html = render(createElement(PermissionsForm, { person: NATI, reasonError: null, rejection: null }));
    expect([inputsNamed(html, 'perm.governance').length, inputsNamed(html, 'perm.codes').length]).toEqual([2, 3]);
  });
});

describe('el adelanto del menú (CA-16)', () => {
  test('⛔ sale de la misma regla que el menú: con «ver» en Códigos ve Inicio y Códigos, no Empresas', () => {
    const html = render(createElement(MenuPreview, { permissions: { codes: 'view' }, isSuperadmin: false }));
    expect([html.includes('>Inicio<'), html.includes('>Códigos<'), html.includes('>Empresas<'), html.includes('>Equipo ensō<')]).toEqual([true, true, false, false]);
  });

  test('con la marca de superadministrador ve también «Equipo ensō»', () => {
    const html = render(createElement(MenuPreview, { permissions: {}, isSuperadmin: true }));
    expect(html.includes('>Equipo ensō<')).toBe(true);
  });
});

describe('los formularios', () => {
  test('el alta lee el correo en minúsculas, solo los niveles que existen y la marca', () => {
    const r = readNewTeamMember(formOf({ email: ' Nati@Beenso.com ', name: 'Nati', reason: 'entra', key: KEY, 'perm.codes': 'edit', 'perm.governance': 'edit', isSuperadmin: '1' }));
    expect('member' in r && r.member).toEqual({ email: 'nati@beenso.com', name: 'Nati', permissions: { codes: 'edit' }, isSuperadmin: true, reason: 'entra', key: KEY });
  });

  test('sin motivo, ni el alta ni el cambio de permisos salen', () => {
    const alta = readNewTeamMember(formOf({ email: 'nati@beenso.com', reason: ' ', key: KEY }));
    const cambio = readPermissionsChange(formOf({ reason: '' }));
    expect(['errors' in alta && Object.keys(alta.errors), 'errors' in cambio && Object.keys(cambio.errors)]).toEqual([['reason'], ['reason']]);
  });

  test('«Guardar permisos» está desactivado mientras nada cambió (CA-17)', () => {
    const html = render(createElement(PermissionsForm, { person: NATI, reasonError: null, rejection: null }));
    const boton = html.match(/<button type="submit"[^>]*>/)?.[0] ?? '';
    expect(boton).toContain('disabled');
  });
});

describe('las rutas', () => {
  test('⛔ CA-15 · crear lleva a la página de la persona, con el aviso', async () => {
    createTeamMember.mockResolvedValue({ kind: 'ok', value: { person: NATI, accountWasNew: true } });
    const r = (await post('/team/new', { email: 'Nati@Beenso.com', reason: 'entra', key: KEY, 'perm.codes': 'view' }, crear as never)) as Response;
    expect(createTeamMember).toHaveBeenCalledWith('token-jose', expect.objectContaining({ email: 'nati@beenso.com', key: KEY, permissions: { codes: 'view' } }));
    expect(r.headers.get('Location')).toBe('/team/sub-nati?aviso=creada');
  });

  test('⛔ CA-15 · un rechazo vuelve con lo escrito, los permisos y la misma clave', async () => {
    createTeamMember.mockResolvedValue({ kind: 'rejected', rejection: { code: 'already-in-team', sub: 'sub-nati' }, createdAccountId: null });
    const r = (await post('/team/new', { email: 'nati@beenso.com', reason: 'entra', key: KEY, 'perm.codes': 'view' }, crear as never)) as Record<string, unknown>;
    const html = render(createElement(TeamNew, { loaderData: { key: 'otra-clave-0000-0000' }, actionData: r } as never), '/team/new');
    expect(html.match(/name="key" value="([^"]+)"/)?.[1] ?? html.match(/value="([^"]+)" name="key"/)?.[1]).toBe(KEY);
    expect(html.includes('href="/team/sub-nati"')).toBe(true);
    expect(inputsNamed(html, 'perm.codes').find((t) => t.includes('value="view"'))).toContain('checked');
  });

  test('⛔ CA-17 · guardar permisos manda también lo oculto, y una acción llega tal cual', async () => {
    changeTeamPermissions.mockResolvedValue({ kind: 'ok', value: NATI });
    await post('/team/sub-nati', { intent: 'permissions', reason: 'más acceso', version: 'W/"4"', 'perm.companies': 'edit', 'perm.skills': 'edit' }, actuar as never, { sub: 'sub-nati' });
    expect(changeTeamPermissions).toHaveBeenCalledWith('token-jose', 'sub-nati', { permissions: { companies: 'edit', skills: 'edit' }, isSuperadmin: false, reason: 'más acceso', version: 'W/"4"' });
    teamAction.mockResolvedValue({ kind: 'ok', value: NATI });
    const r = (await post('/team/sub-nati', { intent: 'suspend', reason: ' vacaciones ', version: 'W/"4"' }, actuar as never, { sub: 'sub-nati' })) as Response;
    expect(teamAction).toHaveBeenCalledWith('token-jose', 'sub-nati', 'suspend', 'vacaciones', 'W/"4"');
    expect(r.headers.get('Location')).toBe('/team/sub-nati?aviso=suspend');
  });

  test('una acción sin motivo, o que no existe, no llega al backend', async () => {
    await post('/team/sub-nati', { intent: 'suspend', reason: '' }, actuar as never, { sub: 'sub-nati' });
    await post('/team/sub-nati', { intent: 'borrar', reason: 'x' }, actuar as never, { sub: 'sub-nati' });
    expect(teamAction).not.toHaveBeenCalled();
  });

  test('⛔ CA-22 · las rutas del equipo son del superadministrador', () => {
    const delEquipo = ROUTE_TABLE.filter((r) => r.path === 'team' || r.path.startsWith('team/'));
    expect(delEquipo.map((r) => [r.path, r.access])).toEqual([['team', 'superadmin'], ['team/new', 'superadmin'], ['team/:sub', 'superadmin']]);
  });
});

describe('las acciones y la página propia', () => {
  test('lo que su estado permite (CA-18)', () => {
    expect([
      teamActionsFor({ status: 'active', invitation: 'expired' }),
      teamActionsFor({ status: 'active', invitation: 'accepted' }),
      teamActionsFor({ status: 'active', invitation: null }),
      teamActionsFor({ status: 'inactive', invitation: 'accepted' }),
      teamActionsFor({ status: 'retired', invitation: null }),
    ]).toEqual([
      ['resend-invitation', 'reset-mfa', 'suspend', 'retire'],
      ['reset-mfa', 'suspend', 'retire'],
      ['reset-mfa', 'suspend', 'retire'],
      ['reactivate', 'retire'],
      [],
    ]);
  });

  test('⛔ CA-18 · ninguna acción se hace de un clic: los botones abren su confirmación', () => {
    const html = render(createElement(TeamMemberActions, { person: NATI, rejection: null, rejectedAction: null }));
    const botones = html.match(/<button[^>]*>/g) ?? [];
    expect(botones.length).toBe(3);
    expect(botones.every((b) => b.includes('type="button"'))).toBe(true);
  });

  test('⛔ CA-20 · en su propia página no hay editor ni acciones', () => {
    const loaderData = { person: { ...NATI, actor: JOSE.actor, sub: 'sub-jose', isSuperadmin: true }, events: [], names: {}, isSelf: true };
    const html = render(createElement(TeamMemberPage, { loaderData, actionData: undefined } as never), '/team/sub-jose');
    expect([html.includes('Guardar permisos'), html.includes('Suspender'), html.includes('los cambia otro superadministrador')]).toEqual([false, false, true]);
  });
});

describe('los rechazos del backend', () => {
  test('el dominio y el motivo van junto a su campo; un correo que ya está trae a quién', () => {
    expect(toWriteRejection({ codigo: 'correo-fuera-del-dominio', campo: 'correo', error: 'solo @beenso.com' })?.rejection).toEqual({ code: 'invalid', message: 'solo @beenso.com', field: 'email' });
    expect(toWriteRejection({ codigo: 'sin-motivo', error: 'x' })?.rejection).toMatchObject({ field: 'reason' });
    expect(toWriteRejection({ codigo: 'ya-en-el-equipo', sub: 'sub-nati' })?.rejection).toEqual({ code: 'already-in-team', sub: 'sub-nati' });
  });
});

// ── Lo que encontró la revisión del panel (2026-11-13) ──────────────────────────────────────────
describe('los arreglos de la revisión', () => {
  test('⛔ con la marca de superadministrador las filas se atenúan pero no se desactivan: guardar no borra sus módulos', () => {
    // Un campo `disabled` no viaja con el formulario: guardar con la marca borraría los módulos que tenía.
    const html = render(createElement(PermissionsForm, { person: { ...NATI, isSuperadmin: true }, reasonError: null, rejection: null }));
    const radios = (html.match(/<input[^>]*type="radio"[^>]*>/g) ?? []);
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.filter((r) => r.includes('disabled'))).toEqual([]);
  });

  test('⛔ CB-9 · guardar y actuar mandan la versión que se vio al abrir la página', () => {
    const html = render(createElement(PermissionsForm, { person: NATI, reasonError: null, rejection: null }));
    expect(inputsNamed(html, 'version')[0]).toContain('value="W/&quot;4&quot;"');
  });

  test('⛔ el rechazo de una acción que ya no se ofrece se dice arriba, con lo que contestó el backend', () => {
    // Una suspensión a medias: la persona ya está suspendida y «Suspender» no se ofrece; su diálogo no vuelve.
    const loaderData = { person: { ...NATI, status: 'inactive' as const }, events: [], names: {}, isSelf: false };
    const actionData = { intent: 'suspend', reasonError: null, rejection: { code: 'action-incomplete', message: 'quedó suspendida en el panel; falta su cuenta en el login, que no respondió: repite la acción para terminar' } };
    const html = render(createElement(TeamMemberPage, { loaderData, actionData } as never));
    expect(html.includes('Quedó suspendida en el panel; falta su cuenta en el login')).toBe(true);
  });

  test('la invitación sin dato se dice con un guion; quien ya entró no lleva marca (CB-12)', () => {
    const html = render(createElement(TeamTable, { people: [{ ...NATI, invitation: null }, { ...NATI, sub: 'sub-beto', actor: 'equipo:sub-beto' }], empty: '' }), '/team');
    expect((html.match(/invitación: —/g) ?? []).length).toBe(1);
  });

  test('cada fila tiene un enlace a la persona: el camino con teclado', () => {
    const html = render(createElement(TeamTable, { people: [NATI], empty: '' }), '/team');
    expect(html.includes('<a href="/team/sub-nati"')).toBe(true);
  });

  test('⛔ CB-4 · si su cuenta del login ya existía, el aviso no promete un correo nuevo', async () => {
    createTeamMember.mockResolvedValue({ kind: 'ok', value: { person: NATI, accountWasNew: false } });
    const r = (await post('/team/new', { email: 'nati@beenso.com', reason: 'entra', key: KEY }, crear as never)) as Response;
    expect(r.headers.get('Location')).toBe('/team/sub-nati?aviso=creada-ya-existia');
  });
});
