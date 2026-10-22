// La configuración del servidor (`app/shared/config/config.server.ts`, CB-11).
//
// EL DEFECTO QUE PREVIENE. Con `PUBLIC_ORIGINS` vacío o mal escrito, la protección CSRF compararía
// contra una lista equivocada: o rechaza todo, o —peor— acepta orígenes que no son el panel.
// Mejor que no arranque y diga qué variable falta.
import { describe, expect, test } from 'vitest';
import { readConfig } from '../app/shared/config/config.server';

describe('readConfig', () => {
  test('lee los orígenes, sin barra final', () => {
    expect(readConfig({ PUBLIC_ORIGINS: 'https://d1.cloudfront.net/, https://admin.beenso.com' }).publicOrigins)
      .toEqual(['https://d1.cloudfront.net', 'https://admin.beenso.com']);
  });

  test('acepta http solo para la máquina local', () => {
    expect(readConfig({ PUBLIC_ORIGINS: 'http://localhost:5173' }).publicOrigins).toEqual(['http://localhost:5173']);
    expect(() => readConfig({ PUBLIC_ORIGINS: 'http://d1.cloudfront.net' })).toThrow(/https/);
  });

  test('⛔ sin orígenes, o con uno mal escrito, falla nombrando la variable', () => {
    for (const bad of [undefined, '', ' , ', 'cloudfront', 'https://d1.cloudfront.net/panel']) {
      expect(() => readConfig({ PUBLIC_ORIGINS: bad }), String(bad)).toThrow(/PUBLIC_ORIGINS/);
    }
  });
});
