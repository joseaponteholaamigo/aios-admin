// El arranque en dos tiempos del servidor (`server/startup.js`, CB-12).
//
// EL DEFECTO QUE PREVIENE. Si el servidor esperara a SSM antes de escuchar, una lectura lenta
// pasaría los 10 s que da Lambda y la Web Function no arrancaría. Si un fallo de SSM no se
// reintentara, el panel quedaría en 503 hasta el próximo despliegue aunque el backend ya hubiera
// escrito los parámetros. Y si una configuración mal escrita se reintentara para siempre, el panel
// quedaría en 503 sin decir que el problema no es pasajero.
import { describe, expect, test } from 'vitest';
import { createStartup, RETRY_AFTER_MS } from '../server/startup.js';

function setup({ environmentFails = 0, appFails = false } = {}) {
  let clock = 0;
  let environmentCalls = 0;
  const fatal: unknown[] = [];
  const logs: string[] = [];
  const startup = createStartup({
    async loadEnvironment() {
      environmentCalls += 1;
      if (environmentCalls <= environmentFails) throw new Error('Faltan parámetros de SSM: /aios/admin/api-url');
    },
    async loadApp() {
      if (appFails) throw new Error('Falta PUBLIC_ORIGINS');
      return 'app' as const;
    },
    onFatal: (e) => fatal.push(e),
    log: (m) => logs.push(m),
    now: () => clock,
  });
  return { startup, fatal, logs, environmentCalls: () => environmentCalls, advance: (ms: number) => { clock += ms; } };
}

describe('createStartup', () => {
  test('antes de prepararse no hay app; después, sí', async () => {
    const { startup } = setup();
    const first = startup.start();
    expect(startup.handler()).toBeNull();
    await first;
    expect(startup.handler()).toBe('app');
  });

  test('⛔ si SSM falla, lo deja en el log y reintenta con un pedido después del plazo, no antes', async () => {
    const { startup, logs, environmentCalls, advance } = setup({ environmentFails: 1 });
    await startup.start();
    expect(logs.join('\n')).toContain('/aios/admin/api-url');
    advance(RETRY_AFTER_MS - 1);
    expect(startup.handler()).toBeNull();
    expect(environmentCalls()).toBe(1);
    advance(1);
    expect(startup.handler()).toBeNull();
    expect(environmentCalls()).toBe(2);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    expect(startup.handler()).toBe('app');
  });

  test('⛔ una configuración que no carga no se reintenta: es fatal', async () => {
    const { startup, fatal } = setup({ appFails: true });
    await startup.start();
    expect(fatal).toHaveLength(1);
  });

  test('muchos pedidos a la vez disparan un solo intento', async () => {
    const { startup, environmentCalls } = setup();
    await Promise.all([startup.start(), startup.start(), Promise.resolve(startup.handler())]);
    expect(environmentCalls()).toBe(1);
  });
});

describe('waitForHandler', () => {
  const quiet = { onFatal: () => {}, log: () => {} };

  test('⛔ un pedido que llega mientras la app se prepara espera y la recibe: el arranque en frío no da 503', async () => {
    let finish = () => {};
    const startup = createStartup({ ...quiet, loadEnvironment: () => new Promise<void>((resolve) => { finish = resolve; }), loadApp: async () => 'app' });
    void startup.start();
    const waiting = startup.waitForHandler(1000);
    finish();
    expect(await waiting).toBe('app');
  });

  test('si leer la configuración falló, responde enseguida, sin esperar el plazo', async () => {
    const startup = createStartup({ ...quiet, loadEnvironment: async () => { throw new Error('Faltan parámetros'); }, loadApp: async () => 'app' });
    await startup.start();
    const startedAt = Date.now();
    expect(await startup.waitForHandler(5000)).toBeNull();
    expect(Date.now() - startedAt).toBeLessThan(100);
  });

  test('no espera más que el plazo', async () => {
    const startup = createStartup({ ...quiet, loadEnvironment: () => new Promise<void>(() => {}), loadApp: async () => 'app' });
    void startup.start();
    expect(await startup.waitForHandler(20)).toBeNull();
  });
});
