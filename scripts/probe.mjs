#!/usr/bin/env node
// Mide el panel durante un rato: un pedido por segundo a una página, con su estado y su tiempo.
// Es la herramienta de la prueba técnica de M1 (CA-32):
//   - el arranque en frío: la primera respuesta después de un rato sin uso;
//   - la continuidad durante un `npm run infra:deploy`: ninguna respuesta fuera de 2xx o 3xx.
//
// Uso: npm run probe -- <url del panel> [segundos, 300 por defecto]
// Termina con código 1 si alguna respuesta falló.

const [panelUrl, secondsArg] = process.argv.slice(2);
if (!panelUrl) {
  console.error('Uso: npm run probe -- <url del panel> [segundos]');
  process.exit(2);
}
const url = `${new URL(panelUrl).origin}/auth/no-access`;
const seconds = Number(secondsArg ?? 300);
const results = [];

for (let i = 0; i < seconds; i += 1) {
  const startedAt = performance.now();
  let status;
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    await response.arrayBuffer();
    status = response.status;
  } catch (e) {
    status = e instanceof Error ? e.name : 'error';
  }
  const ms = Math.round(performance.now() - startedAt);
  results.push({ status, ms });
  console.log(`${new Date().toISOString()}  ${status}  ${ms} ms`);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1000 - ms)));
}

const failures = results.filter(({ status }) => typeof status !== 'number' || status >= 400);
const byStatus = Object.groupBy(results, ({ status }) => String(status));
console.log(`\n${results.length} pedidos · primero: ${results[0]?.ms} ms (con arranque en frío si estaba sin uso) · más lento: ${Math.max(...results.map((r) => r.ms))} ms`);
console.log(`Por estado: ${Object.entries(byStatus).map(([status, list]) => `${status} × ${list?.length}`).join(', ')}`);
console.log(failures.length ? `⛔ ${failures.length} fallaron` : 'Ninguno falló');
process.exit(failures.length ? 1 : 0);
