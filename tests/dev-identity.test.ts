// La identidad falsa de desarrollo (`dev/identity/`, CA-29, decisión G).
//
// EL DEFECTO QUE PREVIENE. Si la identidad falsa no se comportara como Cognito, `npm run dev`
// probaría otro login que el de AWS: un error de PKCE, de `nonce` o de renovación aparecería recién
// en producción. Si sus tokens no llevaran lo que exige la puerta del backend, `/yo` respondería
// 401 en local. Y si aceptara cualquier retorno o cualquier cliente, sería un ejemplo de lo que
// el panel nunca debe aceptar.
import { createHash, createPublicKey, createVerify, randomBytes, type JsonWebKey } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import { readConfig } from '../app/shared/config/config.server';
import { createSessionService } from '../app/shared/session/session.server';
import { createMemorySessionStore } from '../app/shared/session/memory-store.server';
import { createLocalCipher } from '../app/shared/session/local-cipher.server';
import { createPendingLogins, LOGIN_COOKIE } from '../app/shared/auth/pending-login.server';
import { createCognitoClient, decodeJwtClaims, type CognitoClient } from '../app/shared/auth/cognito-client.server';
import { createLoginFlow, type LoginFlow } from '../app/shared/auth/login-flow.server';
import { createDevIdentity, devSub, type DevIdentity } from '../dev/identity/identity-provider';
import { createBackendSeeder, DevSeedError, type DevPerson } from '../dev/identity/backend-seeder';
import { DEV_IDENTITY_MARKER } from '../dev/identity/login-page';
import { createTokenSigner } from '../dev/identity/token-signer';
import { CLIENT_ID, CLIENT_SECRET, ORIGIN, TEST_ENV } from './helpers/fake-cognito';

const ISSUER = `${ORIGIN}/dev/identity`;
const CALLBACK = `${ORIGIN}/auth/callback`;
// Una sola clave para todo el archivo: generarla cuesta, y lo que se prueba no depende de cuál sea.
const signer = createTokenSigner();

let t: number;
let saved: DevPerson[];
let seedFails: Error | null;
let identity: DevIdentity;
let cognito: CognitoClient;
let flow: LoginFlow;

const config = readConfig({ ...TEST_ENV, COGNITO_LOGIN_URL: ISSUER, COGNITO_ISSUER: ISSUER });
const callIdentity = (async (input: RequestInfo | URL, init?: RequestInit) => (await identity(new Request(input, init)))!) as typeof fetch;

beforeEach(() => {
  t = Date.UTC(2026, 9, 22, 9);
  saved = [];
  seedFails = null;
  identity = createDevIdentity({
    issuer: ISSUER, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, publicOrigins: [ORIGIN], signer, now: () => t,
    savePerson: async (person) => {
      if (seedFails) throw seedFails;
      saved.push(person);
    },
  });
  const store = createMemorySessionStore();
  const cipher = createLocalCipher();
  cognito = createCognitoClient({ config: config.cognito, clientSecret: async () => CLIENT_SECRET, fetchImpl: callIdentity, now: () => t });
  flow = createLoginFlow({
    config, cognito, pending: createPendingLogins({ store, cipher, now: () => t }),
    sessions: createSessionService({ store, cipher, now: () => t }), now: () => t, log: () => {},
  });
});

const ANA = { email: 'Ana@Dev.Local', name: 'Ana', perm_companies: 'view', perm_usage: 'edit' };

/** El recorrido del navegador: el panel manda al login, la persona elige y envía, Cognito vuelve. */
async function signIn(fields: Record<string, string>) {
  const start = await flow.startLogin(new Request(`${ORIGIN}/auth/login?returnTo=%2F`));
  const authorizeUrl = start.headers.get('location')!;
  const loginCookie = start.headers.getSetCookie().find((c) => c.startsWith(`${LOGIN_COOKIE}=`))!.split(';')[0]!;
  const page = (await identity(new Request(authorizeUrl)))!;
  const body = new URLSearchParams([...new URL(authorizeUrl).searchParams, ...Object.entries(fields)]);
  const submit = (await identity(new Request(authorizeUrl, { method: 'POST', body })))!;
  const back = submit.headers.get('location');
  const finished = back ? await flow.finishLogin(new Request(back, { headers: { cookie: loginCookie } })) : null;
  return { page, submit, back, finished };
}

/**
 * Un login directo contra la identidad, guardando el verificador PKCE: así la prueba ve los
 * tokens, que el login del panel nunca deja salir.
 */
async function directSignIn() {
  const verifier = randomBytes(32).toString('base64url');
  const body = new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID, redirect_uri: CALLBACK, scope: 'openid email profile admin/acceso',
    state: 's', nonce: 'n', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    ...ANA,
  });
  const submit = (await identity(new Request(`${ISSUER}/oauth2/authorize`, { method: 'POST', body })))!;
  return { code: new URL(submit.headers.get('location')!).searchParams.get('code')!, verifier };
}

async function signInTokens() {
  const { code, verifier } = await directSignIn();
  return (await cognito.exchangeCode({ code, verifier, redirectUri: CALLBACK })).tokens;
}

function verifiesAgainstJwks(token: string) {
  const [header, payload, signature] = token.split('.');
  const { kid } = JSON.parse(Buffer.from(header!, 'base64url').toString()) as { kid: string };
  const jwk = signer.jwks().keys.find((k) => k.kid === kid);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${header}.${payload}`);
  return verifier.verify(createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' }), signature!, 'base64url');
}

describe('identidad falsa', () => {
  test('el login del panel la recorre entera y queda una sesión de la persona elegida', async () => {
    const { page, finished } = await signIn(ANA);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain(DEV_IDENTITY_MARKER);
    expect(finished?.ok).toBe(true);
    expect(saved).toEqual([{
      sub: devSub('ana@dev.local'), email: 'ana@dev.local', name: 'Ana', isSuperadmin: false, suspended: false,
      permissions: { companies: 'view', usage: 'edit' },
    }]);
  });

  test('⛔ el access token lleva lo que exige la puerta del backend, firmado con la clave del JWKS', async () => {
    const tokens = await signInTokens();
    const claims = decodeJwtClaims(tokens.accessToken);
    expect(verifiesAgainstJwks(tokens.accessToken)).toBe(true);
    expect(claims).toMatchObject({ iss: ISSUER, client_id: CLIENT_ID, token_use: 'access', acr: 'urn:cognito:loa:4', sub: devSub(ANA.email) });
    expect(String(claims.scope).split(' ')).toContain('admin/acceso');
    expect(claims.auth_time).toBe(t / 1000);
  });

  test('renovar conserva el momento del login (el MFA reciente vence igual que en Cognito); revocar corta', async () => {
    const tokens = await signInTokens();
    const loginAt = t / 1000;
    t += 2 * 60 * 60 * 1000;
    const renewed = await cognito.refresh(tokens.refreshToken);
    expect(decodeJwtClaims(renewed.accessToken).auth_time).toBe(loginAt);
    await cognito.revoke(tokens.refreshToken);
    await expect(cognito.refresh(tokens.refreshToken)).rejects.toMatchObject({ status: 400 });
  });

  test('⛔ un código sirve una sola vez y solo con su verificador PKCE', async () => {
    const first = await directSignIn();
    await cognito.exchangeCode({ code: first.code, verifier: first.verifier, redirectUri: CALLBACK });
    await expect(cognito.exchangeCode({ code: first.code, verifier: first.verifier, redirectUri: CALLBACK })).rejects.toMatchObject({ status: 400 });
    const second = await directSignIn();
    await expect(cognito.exchangeCode({ code: second.code, verifier: 'otro', redirectUri: CALLBACK })).rejects.toMatchObject({ status: 400 });
  });

  test('⛔ rechaza un retorno que no es del panel, otro cliente y un secreto equivocado', async () => {
    const start = await flow.startLogin(new Request(`${ORIGIN}/auth/login`));
    const url = new URL(start.headers.get('location')!);
    url.searchParams.set('redirect_uri', 'https://evil.example/auth/callback');
    expect((await identity(new Request(url)))!.status).toBe(400);
    url.searchParams.set('redirect_uri', `${ORIGIN}/auth/callback`);
    url.searchParams.set('client_id', 'otro-cliente');
    expect((await identity(new Request(url)))!.status).toBe(400);
    const intruder = createCognitoClient({ config: config.cognito, clientSecret: async () => 'adivinado', fetchImpl: callIdentity });
    await expect(intruder.refresh('x')).rejects.toMatchObject({ status: 401 });
  });

  test('si el backend local no guarda a la persona, la pantalla lo dice y no entra', async () => {
    seedFails = new DevSeedError('No llegué al backend local');
    const { submit, back } = await signIn(ANA);
    expect(submit.status).toBe(502);
    expect(back).toBeNull();
    expect(await submit.text()).toContain('No llegué al backend local');
  });

  test('⛔ la salida solo vuelve a un origen del panel', async () => {
    const out = (target: string) => identity(new Request(`${ISSUER}/logout?client_id=${CLIENT_ID}&logout_uri=${encodeURIComponent(target)}`));
    expect((await out(`${ORIGIN}/`))!.status).toBe(302);
    expect((await out('https://evil.example/'))!.status).toBe(400);
  });

  test('no atiende lo que no está bajo su ruta', async () => {
    expect(await identity(new Request(`${ORIGIN}/auth/login`))).toBeNull();
  });
});

describe('backend-seeder', () => {
  const person: DevPerson = { sub: 'dev-1', email: 'ana@dev.local', name: 'Ana', isSuperadmin: false, suspended: true, permissions: { companies: 'view' } };

  test('manda la persona con los nombres del backend', async () => {
    let sent: { url: string; body: unknown } | null = null;
    const save = createBackendSeeder({
      adminApiUrl: 'http://127.0.0.1:7071',
      fetchImpl: (async (url: string, init: RequestInit) => { sent = { url, body: JSON.parse(String(init.body)) }; return new Response('{}'); }) as unknown as typeof fetch,
    });
    await save(person);
    expect(sent).toEqual({
      url: 'http://127.0.0.1:7071/dev/equipo/dev-1',
      body: { correo: 'ana@dev.local', nombre: 'Ana', superadmin: false, estado: 'suspendida', permisos: { empresas: 'ver' } },
    });
  });

  test('sin la ruta en el backend (no corre contra DynamoDB Local), dice cómo arrancarlo', async () => {
    const save = createBackendSeeder({ adminApiUrl: 'http://x', fetchImpl: (async () => new Response('', { status: 404 })) as typeof fetch });
    await expect(save(person)).rejects.toThrow(/DynamoDB Local/);
  });
});
