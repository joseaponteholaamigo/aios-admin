// El login con Cognito (`app/shared/auth/login-flow.server.ts`; CA-18, CA-19, CA-21, CA-22, CA-23, CB-2).
//
// EL DEFECTO QUE PREVIENE. El login es la puerta del panel. Sin PKCE, un código interceptado se
// canjea; sin `state` atado al navegador, alguien mete a otra persona en SU sesión; sin `nonce`,
// un ID token viejo se reusa; si el retorno se armara con el Host, detrás de CloudFront volvería al
// endpoint de Lambda; si `returnTo` aceptara cualquier dirección, el panel serviría de trampolín
// hacia un sitio falso; y si cerrar sesión no revocara ni pasara por Cognito, volver a entrar no
// pediría el MFA.
import { beforeEach, describe, expect, test } from 'vitest';
import { createSessionService, SESSION_COOKIE, type SessionService } from '../app/shared/session/session.server';
import { createMemorySessionStore } from '../app/shared/session/memory-store.server';
import { createLocalCipher } from '../app/shared/session/local-cipher.server';
import { createPendingLogins, LOGIN_COOKIE, LOGIN_TTL_MS } from '../app/shared/auth/pending-login.server';
import { createCognitoClient, FRESH_MFA, IdentityProviderError } from '../app/shared/auth/cognito-client.server';
import { createLoginFlow, loginAssuranceLine, safeReturnTo, type LoginFlow } from '../app/shared/auth/login-flow.server';
import { freshMfaRedirect, needsFreshMfa } from '../app/shared/auth/fresh-mfa.server';
import { CLIENT_ID, CLIENT_SECRET, LOGIN_URL, ORIGIN, fakeCognito, testConfig } from './helpers/fake-cognito';

const LAMBDA = 'https://abcd.b7t.lambda-web.us-east-2.on.aws';
let t: number;
let cognito: ReturnType<typeof fakeCognito>;
let sessions: SessionService;
let flow: LoginFlow;
let logs: string[];
let infos: string[];

beforeEach(() => {
  t = Date.UTC(2026, 9, 22, 9);
  cognito = fakeCognito({ now: () => t });
  const store = createMemorySessionStore();
  const cipher = createLocalCipher();
  const config = testConfig();
  sessions = createSessionService({ store, cipher, now: () => t });
  logs = [];
  infos = [];
  flow = createLoginFlow({
    config,
    cognito: createCognitoClient({ config: config.cognito, clientSecret: async () => CLIENT_SECRET, fetchImpl: cognito.fetchImpl, now: () => t }),
    pending: createPendingLogins({ store, cipher, now: () => t }),
    sessions,
    now: () => t,
    log: (m) => logs.push(m),
    info: (m) => infos.push(m),
  });
});

const cookieValue = (setCookie: string) => setCookie.split(';')[0]!;
const loginCookieFrom = (r: Response) => r.headers.getSetCookie().find((c) => c.startsWith(`${LOGIN_COOKIE}=`))!;

async function start(path = '/auth/login?returnTo=%2Fempresas') {
  const response = await flow.startLogin(new Request(`${LAMBDA}${path}`));
  return { response, location: response.headers.get('location')!, cookie: cookieValue(loginCookieFrom(response)) };
}

const callback = (query: string, cookie?: string) =>
  flow.finishLogin(new Request(`${LAMBDA}/auth/callback?${query}`, { headers: cookie ? { cookie } : {} }));

describe('empezar', () => {
  test('⛔ manda a Cognito con código, PKCE S256, state, nonce, el scope de admin y el retorno del origen público', async () => {
    const { response, location } = await start();
    expect(response.status).toBe(302);
    const url = new URL(location);
    expect(`${url.origin}${url.pathname}`).toBe(`${LOGIN_URL}/oauth2/authorize`);
    const p = url.searchParams;
    expect(p.get('response_type')).toBe('code');
    expect(p.get('client_id')).toBe(CLIENT_ID);
    expect(p.get('redirect_uri')).toBe(`${ORIGIN}/auth/callback`);
    expect(p.get('scope')?.split(' ')).toContain('admin/acceso');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('state')?.length).toBeGreaterThan(30);
    expect(p.get('nonce')?.length).toBeGreaterThan(30);
    expect(p.get('acr_values')).toBeNull();
  });

  test('cada ingreso tiene su propio state y nonce, y la cookie lo ata al navegador', async () => {
    const [a, b] = [await start(), await start()];
    const state = (l: string) => new URL(l).searchParams.get('state');
    expect(state(a.location)).not.toBe(state(b.location));
    expect(a.cookie).toBe(`${LOGIN_COOKIE}=${state(a.location)}`);
  });

  test('⛔ con mfa=1 pide contraseña + TOTP de menos de 15 minutos', async () => {
    const p = new URL((await start('/auth/login?mfa=1')).location).searchParams;
    expect(p.get('acr_values')).toBe(FRESH_MFA.acr);
    expect(p.get('max_age')).toBe('900');
  });

  test('⛔ la vuelta solo acepta rutas del panel', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'empresas', '', null]) {
      expect(safeReturnTo(bad), String(bad)).toBe('/');
    }
    expect(safeReturnTo('/empresas?filtro=activas')).toBe('/empresas?filtro=activas');
  });

  test('⛔ ni con tabuladores o saltos de línea, que el navegador quita y dejan «//otro-sitio»', () => {
    for (const bad of ['/\t/evil.example/phish', '/\n/evil.example', '/\r/evil.example', '/\u0000/evil.example', '/./\\evil.example']) {
      expect(safeReturnTo(bad), JSON.stringify(bad)).toBe('/');
    }
    // Codificado no es un truco: el navegador no lo decodifica al resolver, y queda dentro del panel.
    expect(safeReturnTo('/%09/evil.example')).toBe('/%09/evil.example');
  });

  test('⛔ ni con puntos que, al normalizarse, dejan «//otro-sitio» en la redirección', () => {
    for (const bad of ['/.//evil.example/x', '/a/..//evil.example', '/%2e//evil.example', '//evil.example/robar']) {
      expect(safeReturnTo(bad), bad).toBe('/');
    }
    expect(safeReturnTo('/empresas/../usuarios')).toBe('/usuarios');
  });

  test('⛔ el login real con un tabulador en la vuelta termina en el panel, no en otro sitio', async () => {
    const { location, cookie } = await start('/auth/login?returnTo=%2F%09%2Fevil.example%2Fphish');
    const { code, state } = cognito.authorize(location, 'sub-nati');
    const result = await callback(`code=${code}&state=${state}`, cookie);
    expect(result.ok && result.response.headers.get('location')).toBe('/');
  });
});

describe('volver', () => {
  test('⛔ con todo en orden crea la sesión, vuelve a donde estaba, y ningún token llega al navegador', async () => {
    const { location, cookie } = await start();
    const { code, state } = cognito.authorize(location, 'sub-nati');
    const result = await callback(`code=${code}&state=${state}`, cookie);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get('location')).toBe('/empresas');
    const setCookies = result.response.headers.getSetCookie();
    const session = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(setCookies).toContain(`${LOGIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    const read = await sessions.read(new Request(ORIGIN, { headers: { cookie: cookieValue(session) } }));
    expect(read.session?.sub).toBe('sub-nati');
    const visible = JSON.stringify([...result.response.headers]) + (await result.response.text());
    expect(visible).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);
  });

  test('⛔ sin la cookie del navegador que empezó, o con otra, no entra', async () => {
    const { location } = await start();
    const { code, state } = cognito.authorize(location);
    expect((await callback(`code=${code}&state=${state}`)).ok).toBe(false);
    const other = await start();
    expect((await callback(`code=${code}&state=${state}`, other.cookie)).ok).toBe(false);
  });

  test('⛔ un retorno repetido o de hace más de 10 minutos no entra', async () => {
    const first = await start();
    const a = cognito.authorize(first.location);
    expect((await callback(`code=${a.code}&state=${a.state}`, first.cookie)).ok).toBe(true);
    expect((await callback(`code=${a.code}&state=${a.state}`, first.cookie)).ok).toBe(false);

    const late = await start();
    const b = cognito.authorize(late.location);
    t += LOGIN_TTL_MS;
    expect((await callback(`code=${b.code}&state=${b.state}`, late.cookie)).ok).toBe(false);
  });

  test('⛔ el login pendiente es de un solo uso, aunque llegue con otro código', async () => {
    // El Cognito real rechaza un código repetido; esto prueba que de este lado tampoco se reusa el
    // `state`: un segundo retorno con un código nuevo no encuentra su login pendiente.
    const first = await start();
    const a = cognito.authorize(first.location);
    expect((await callback(`code=${a.code}&state=${a.state}`, first.cookie)).ok).toBe(true);
    const b = cognito.authorize(first.location);
    expect((await callback(`code=${b.code}&state=${a.state}`, first.cookie)).ok).toBe(false);
  });

  test('⛔ un ID token con otro nonce no entra', async () => {
    const { location, cookie } = await start();
    const { code, state } = cognito.authorize(location);
    cognito.setNonce('otro-nonce');
    const result = await callback(`code=${code}&state=${state}`, cookie);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  test('si Cognito no responde, explica sin detalles, no crea sesión y no registra el código', async () => {
    const { location, cookie } = await start();
    const { code, state } = cognito.authorize(location);
    cognito.setDown(true);
    const result = await callback(`code=${code}&state=${state}`, cookie);
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(logs.join(' ')).not.toContain(code);
  });

  test('si la persona canceló en Cognito, no entra', async () => {
    const { cookie } = await start();
    expect(await callback('error=access_denied&state=x', cookie)).toMatchObject({ ok: false, status: 400 });
  });
});

async function loggedIn() {
  const { location, cookie } = await start();
  const { code, state } = cognito.authorize(location);
  const result = await callback(`code=${code}&state=${state}`, cookie);
  if (!result.ok) throw new Error('no entró');
  const sessionCookie = cookieValue(result.response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!);
  const request = new Request(`${LAMBDA}/`, { headers: { cookie: sessionCookie } });
  return { request, session: (await sessions.read(request)).session! };
}

describe('renovar', () => {
  test('con el access token por vencer, lo renueva en el servidor y lo guarda', async () => {
    const { request, session } = await loggedIn();
    t += 14.5 * 60 * 1000;
    const fresh = await flow.refreshIfNeeded(session);
    expect(cognito.refreshes()).toBe(1);
    expect(fresh?.tokens.accessToken).not.toBe(session.tokens.accessToken);
    expect((await sessions.read(request)).session?.tokens.accessToken).toBe(fresh?.tokens.accessToken);
  });

  test('con tiempo de sobra no llama a Cognito', async () => {
    const { session } = await loggedIn();
    expect(await flow.refreshIfNeeded(session)).toBe(session);
    expect(cognito.refreshes()).toBe(0);
  });

  test('⛔ con el refresh token revocado no hay sesión', async () => {
    const { session } = await loggedIn();
    cognito.revoked.push(session.tokens.refreshToken);
    t += 15 * 60 * 1000;
    expect(await flow.refreshIfNeeded(session)).toBeNull();
  });

  test('si Cognito no responde, la sesión no se cierra: sigue con el token vigente y lo deja en el log', async () => {
    const { session } = await loggedIn();
    cognito.setDown(true);
    t += 14.5 * 60 * 1000;
    expect(await flow.refreshIfNeeded(session)).toBe(session);
    expect(logs.join('\n')).toContain('No se pudo renovar');
  });

  test('si Cognito no responde y el token ya venció, lanza en vez de cerrar la sesión', async () => {
    const { session } = await loggedIn();
    cognito.setDown(true);
    t += 16 * 60 * 1000;
    await expect(flow.refreshIfNeeded(session)).rejects.toBeInstanceOf(IdentityProviderError);
  });
});

describe('salir', () => {
  test('⛔ revoca el refresh token, borra la sesión, vence la cookie y pasa por el logout de Cognito', async () => {
    const { request, session } = await loggedIn();
    const response = await flow.logout(request);
    expect(cognito.revoked).toEqual([session.tokens.refreshToken]);
    expect((await sessions.read(request)).session).toBeNull();
    expect(response.headers.getSetCookie()[0]).toContain('Max-Age=0');
    const location = new URL(response.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe(`${LOGIN_URL}/logout`);
    expect(location.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(location.searchParams.get('logout_uri')).toBe(`${ORIGIN}/`);
  });
});

describe('MFA reciente', () => {
  test('⛔ cuando el backend lo pide, vuelve al login con mfa=1 y a la misma página', () => {
    expect(needsFreshMfa(401, { codigo: 'mfa-reciente' })).toBe(true);
    expect(needsFreshMfa(401, { codigo: 'otro' })).toBe(false);
    const location = freshMfaRedirect(new Request(`${LAMBDA}/equipo/sub-nati/permisos.data`)).headers.get('location')!;
    const p = new URL(location, ORIGIN).searchParams;
    expect(p.get('mfa')).toBe('1');
    expect(p.get('returnTo')).toBe('/equipo/sub-nati/permisos');
  });
});

describe('la garantía del login, en el log', () => {
  // El access token nunca llega al navegador: esta línea es la única forma de ver si Cognito pone
  // `acr` (MFA) y `auth_time` en el token que el backend revisa antes de un cambio de permisos.
  const AUTH_TIME = Date.UTC(2026, 9, 22, 8, 55) / 1000;

  async function finishLoginFrom(path: string) {
    const { location, cookie } = await start(path);
    const { code, state } = cognito.authorize(location, 'sub-nati');
    expect((await callback(`code=${code}&state=${state}`, cookie)).ok).toBe(true);
  }

  test('⛔ un login completo deja una línea con el acr, el auth_time y si se pidió MFA reciente', async () => {
    cognito.setAccessClaims({ acr: FRESH_MFA.acr, auth_time: AUTH_TIME });
    await finishLoginFrom('/auth/login?mfa=1');
    expect(infos).toEqual([
      `login completo · MFA reciente pedido: sí · acr=${FRESH_MFA.acr} · auth_time=2026-10-22T08:55:00.000Z`,
    ]);
  });

  test('⛔ si el token no trae acr ni auth_time, la línea lo dice en vez de callarlo', async () => {
    await finishLoginFrom('/auth/login');
    expect(infos).toEqual(['login completo · MFA reciente pedido: no · acr=(no viene) · auth_time=(no viene)']);
  });

  test('⛔ la línea no lleva el token ni quién entró', async () => {
    cognito.setAccessClaims({ acr: FRESH_MFA.acr, auth_time: AUTH_TIME });
    await finishLoginFrom('/auth/login');
    expect(infos).toHaveLength(1);
    expect(infos[0]).not.toContain('sub-nati');
    expect(infos[0]).not.toMatch(/eyJ/);
  });

  test('un token sin forma de JWT no frena el login: la línea dice que no vienen', () => {
    expect(loginAssuranceLine('no-es-un-jwt', false)).toBe('login completo · MFA reciente pedido: no · acr=(no viene) · auth_time=(no viene)');
  });

  test('un intento fallido no deja la línea', async () => {
    const { location, cookie } = await start();
    const { code, state } = cognito.authorize(location);
    cognito.setNonce('otro-nonce');
    expect((await callback(`code=${code}&state=${state}`, cookie)).ok).toBe(false);
    expect(infos).toEqual([]);
  });
});
