// La configuración del servidor (`app/shared/config/config.server.ts`, CB-11).
//
// EL DEFECTO QUE PREVIENE. Con `PUBLIC_ORIGINS` vacío o mal escrito, la protección CSRF compararía
// contra una lista equivocada: o rechaza todo, o —peor— acepta orígenes que no son el panel. Y
// con las sesiones en memoria por omisión, en AWS cada entorno tendría las suyas y la gente
// perdería la sesión al azar. Mejor que no arranque y diga qué variable falta.
import { describe, expect, test } from 'vitest';
import { readConfig } from '../app/shared/config/config.server';

const BASE = { PUBLIC_ORIGINS: 'https://d1.cloudfront.net', SESSION_STORE: 'memory' };

describe('readConfig', () => {
  test('lee los orígenes, sin barra final', () => {
    expect(readConfig({ ...BASE, PUBLIC_ORIGINS: 'https://d1.cloudfront.net/, https://admin.beenso.com' }).publicOrigins)
      .toEqual(['https://d1.cloudfront.net', 'https://admin.beenso.com']);
  });

  test('acepta http solo para la máquina local', () => {
    expect(readConfig({ ...BASE, PUBLIC_ORIGINS: 'http://localhost:5173' }).publicOrigins).toEqual(['http://localhost:5173']);
    expect(() => readConfig({ ...BASE, PUBLIC_ORIGINS: 'http://d1.cloudfront.net' })).toThrow(/https/);
  });

  test('⛔ sin orígenes, o con uno mal escrito, falla nombrando la variable', () => {
    for (const bad of [undefined, '', ' , ', 'cloudfront', 'https://d1.cloudfront.net/panel']) {
      expect(() => readConfig({ ...BASE, PUBLIC_ORIGINS: bad }), String(bad)).toThrow(/PUBLIC_ORIGINS/);
    }
  });

  test('⛔ dónde viven las sesiones se escribe a propósito: sin SESSION_STORE no arranca', () => {
    expect(() => readConfig({ PUBLIC_ORIGINS: BASE.PUBLIC_ORIGINS })).toThrow(/SESSION_STORE/);
    expect(() => readConfig({ ...BASE, SESSION_STORE: 'redis' })).toThrow(/SESSION_STORE/);
  });

  test('con DynamoDB exige la tabla y la llave KMS', () => {
    expect(() => readConfig({ ...BASE, SESSION_STORE: 'dynamodb', SESSION_KMS_KEY_ID: 'k' })).toThrow(/SESSION_TABLE/);
    expect(() => readConfig({ ...BASE, SESSION_STORE: 'dynamodb', SESSION_TABLE: 't' })).toThrow(/SESSION_KMS_KEY_ID/);
    expect(readConfig({ ...BASE, SESSION_STORE: 'dynamodb', SESSION_TABLE: 't', SESSION_KMS_KEY_ID: 'k' }).sessionStore)
      .toEqual({ kind: 'dynamodb', table: 't', kmsKeyId: 'k' });
  });
});
