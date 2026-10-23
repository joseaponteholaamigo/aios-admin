#!/usr/bin/env node
// La prueba rápida después de cada despliegue (CA-36).
//
// Uso: npm run smoke -- <url del panel> <url de la API de admin>
//   (las dos salen de las salidas de los stacks: `PanelUrl` del panel y el parámetro
//   `/aios/admin/api-url` del backend)
//
// Lambda marca una revisión «activa» aunque el servidor no arranque: esto confirma desde afuera,
// como un navegador, que el panel responde de verdad. Termina con código 1 si falla algo.
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ name: string, ok: boolean, detail: string }} Check
 * @param {{ panelUrl: string, apiUrl: string, fetchImpl?: typeof fetch }} options
 * @returns {Promise<Check[]>}
 */
export async function runSmoke({ panelUrl, apiUrl, fetchImpl = fetch }) {
  const panel = new URL(panelUrl).origin;
  const api = apiUrl.replace(/\/+$/, '');
  /** @param {string} url @param {RequestInit} [init] */
  const get = (url, init = {}) => fetchImpl(url, { redirect: 'manual', ...init });
  /** @type {Check[]} */
  const checks = [];
  /** @param {string} name @param {unknown} ok @param {string} detail */
  const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

  let r = await get(`${panel}/`);
  check('GET / manda al login del panel', r.status === 302 && r.headers.get('location')?.startsWith('/auth/login'), `${r.status} ${r.headers.get('location')}`);

  r = await get(`${panel}/auth/login`);
  const authorize = r.headers.get('location') ?? '';
  check('el login va a Cognito con PKCE', r.status === 302 && authorize.includes('/oauth2/authorize') && authorize.includes('code_challenge_method=S256'), `${r.status} ${authorize.slice(0, 80)}`);

  r = await get(`${panel}/auth/no-access`);
  const html = await r.text();
  const csp = r.headers.get('content-security-policy') ?? '';
  check('una página responde con CSP y sin caché', r.status === 200 && csp.includes("'nonce-") && r.headers.get('cache-control') === 'no-store', `${r.status} csp=${Boolean(csp)}`);

  const asset = html.match(/\/assets\/[\w.-]+\.(?:js|css)/)?.[0];
  const assetResponse = asset ? await get(`${panel}${asset}`) : null;
  check('los estáticos salen por CloudFront', assetResponse?.status === 200, asset ? `${assetResponse?.status} ${asset}` : 'la página no nombra ningún /assets/');

  // Un POST de verdad hasta el servidor: CloudFront firma el pedido sin el cuerpo, y el servidor
  // responde con su redirección y su `no-store` (un error de CloudFront o de Lambda no lo traería).
  r = await get(`${panel}/auth/logout`, { method: 'POST', headers: { origin: panel, 'sec-fetch-site': 'same-origin' } });
  check('un formulario (POST) llega al servidor', r.status === 302 && r.headers.get('cache-control') === 'no-store', `${r.status}`);

  r = await get(`${api}/v1/admin/yo`);
  check('la API de admin no responde sin token', r.status === 401, `${r.status}`);
  return checks;
}

async function main() {
  const [panelUrl, apiUrl] = process.argv.slice(2);
  if (!panelUrl || !apiUrl) {
    console.error('Uso: npm run smoke -- <url del panel> <url de la API de admin>');
    process.exit(2);
  }
  const checks = await runSmoke({ panelUrl, apiUrl });
  for (const { name, ok, detail } of checks) console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  (${detail})`}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed ? `\n${failed} de ${checks.length} fallaron` : `\nTodo bien (${checks.length} de ${checks.length})`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
