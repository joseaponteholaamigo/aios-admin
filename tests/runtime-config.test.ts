// La configuración que el panel lee de SSM al arrancar (`server/runtime-config.js`, CA-35, CB-12).
//
// EL DEFECTO QUE PREVIENE. Si el panel arrancara con un parámetro vacío, entraría en servicio con
// una configuración a medias (sin cliente de Cognito, sin URL de la API). Si un mapa mal escrito
// pasara, leería otro parámetro que el que el stack le dio permiso de leer. Y si una variable de
// SSM pisara una que no se pidió, la configuración del proceso dependería de lo que haya en SSM.
import { describe, expect, test } from 'vitest';
import { ensureRegion, readSsmParameters, RuntimeConfigUnavailableError, ssmParameterMap } from '../server/runtime-config.js';

const MAP = { COGNITO_POOL_ID: '/aios/equipo/pool-id', ADMIN_API_URL: '/aios/admin/api-url' };

function fakeSsm(values: Record<string, string | undefined>, { fails = false } = {}) {
  const asked: string[][] = [];
  return {
    asked,
    client: {
      async send(command: { input: { Names?: string[] } }) {
        asked.push(command.input.Names ?? []);
        if (fails) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
        const Parameters = (command.input.Names ?? []).flatMap((Name) => (values[Name] === undefined ? [] : [{ Name, Value: values[Name] }]));
        return { Parameters };
      },
    },
  };
}

describe('ssmParameterMap', () => {
  test('sin PANEL_SSM_PARAMETERS no hay nada que leer (la máquina de quien desarrolla)', () => {
    expect(ssmParameterMap({})).toBeNull();
  });

  test('⛔ un mapa mal escrito no arranca, en vez de leer otra cosa', () => {
    for (const bad of ['{', '[]', '{}', '{"lowercase":"/x"}', '{"X":"sin-barra"}', '{"X":3}']) {
      expect(() => ssmParameterMap({ PANEL_SSM_PARAMETERS: bad }), bad).toThrow(/PANEL_SSM_PARAMETERS/);
    }
    expect(ssmParameterMap({ PANEL_SSM_PARAMETERS: JSON.stringify(MAP) })).toEqual(MAP);
  });
});

describe('ensureRegion', () => {
  test('si a la Web Function le faltara AWS_REGION, toma la que pasa el stack; nunca pisa la que hay', () => {
    const missing: Record<string, string | undefined> = { PANEL_REGION: 'us-east-2' };
    ensureRegion(missing);
    expect(missing.AWS_REGION).toBe('us-east-2');
    const present: Record<string, string | undefined> = { AWS_REGION: 'us-east-1', PANEL_REGION: 'us-east-2' };
    ensureRegion(present);
    expect(present.AWS_REGION).toBe('us-east-1');
  });

  test('⛔ sin ninguna de las dos no inventa una región (process.env guardaría el texto "undefined")', () => {
    const env: Record<string, string | undefined> = {};
    ensureRegion(env);
    expect('AWS_REGION' in env).toBe(false);
  });
});

describe('readSsmParameters', () => {
  test('pide los parámetros de una vez y devuelve solo las variables del mapa', async () => {
    const ssm = fakeSsm({ '/aios/equipo/pool-id': 'us-east-2_AbC', '/aios/admin/api-url': 'https://api.example', '/otro': 'x' });
    expect(await readSsmParameters(MAP, ssm.client as never)).toEqual({ COGNITO_POOL_ID: 'us-east-2_AbC', ADMIN_API_URL: 'https://api.example' });
    expect(ssm.asked).toEqual([['/aios/equipo/pool-id', '/aios/admin/api-url']]);
  });

  test('⛔ si falta un parámetro (el backend todavía no hizo su segunda pasada), lo nombra y no devuelve nada', async () => {
    const ssm = fakeSsm({ '/aios/equipo/pool-id': 'us-east-2_AbC' });
    await expect(readSsmParameters(MAP, ssm.client as never)).rejects.toThrow(/\/aios\/admin\/api-url/);
    await expect(readSsmParameters(MAP, fakeSsm({ '/aios/equipo/pool-id': 'x', '/aios/admin/api-url': '' }).client as never))
      .rejects.toBeInstanceOf(RuntimeConfigUnavailableError);
  });

  test('si SSM no responde, es un error que se reintenta', async () => {
    await expect(readSsmParameters(MAP, fakeSsm({}, { fails: true }).client as never)).rejects.toBeInstanceOf(RuntimeConfigUnavailableError);
  });
});
