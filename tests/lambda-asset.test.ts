// El paquete que viaja a la Web Function (`scripts/build-lambda-asset.mjs`).
//
// EL DEFECTO QUE PREVIENE. La identidad falsa de `dev/` deja entrar a cualquiera como
// superadministrador con un clic, y un `.env` o una clave no pueden llegar a la nube. Si una pieza
// de la allow-list los arrastrara, el paquete tiene que abortar, nombrando el archivo.
import { describe, expect, test } from 'vitest';
import { forbiddenEntries, INCLUDED } from '../scripts/build-lambda-asset.mjs';

describe('el paquete del servidor', () => {
  test('⛔ nombra lo que no puede viajar: la identidad falsa, el código fuente, un .env o una clave', () => {
    const wrong = forbiddenEntries(['dev/identity/login-page.ts', 'app/root.tsx', 'tests/x.test.ts', '.env', 'server/.env.local', 'keys/dev.pem', 'server/index.js']);
    expect(wrong.map((line: string) => line.split(':')[0])).toEqual(['dev/identity/login-page.ts', 'app/root.tsx', 'tests/x.test.ts', '.env', 'server/.env.local', 'keys/dev.pem']);
  });

  test('lo que traen las dependencias no frena el paquete: sale de npm ci con el lock', () => {
    expect(forbiddenEntries(['node_modules/some-lib/test/fixtures/key.pem', 'node_modules/x/.env.example'])).toEqual([]);
  });

  test('⛔ la allow-list no incluye nada de lo prohibido', () => {
    expect(forbiddenEntries(INCLUDED.map(({ path }: { path: string }) => path))).toEqual([]);
    expect(INCLUDED.map(({ path }: { path: string }) => path)).toContain('server');
  });
});
