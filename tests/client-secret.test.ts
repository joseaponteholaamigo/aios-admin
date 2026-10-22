// El secreto del cliente del panel (`app/shared/auth/client-secret.server.ts`, CA-35).
//
// EL DEFECTO QUE PREVIENE. En AWS el secreto no puede vivir en una variable ni en la plantilla:
// se lee del pool, del pool del EQUIPO y del cliente del panel. Leerlo en cada login sería lento y
// caro; guardar un fallo pasajero dejaría a todos sin poder entrar hasta reiniciar.
import { expect, test } from 'vitest';
import { createClientSecretSource } from '../app/shared/auth/client-secret.server';
import type { CognitoConfig } from '../app/shared/config/config.server';

const fromPool: CognitoConfig = { loginUrl: 'https://l', issuer: 'https://i', clientId: 'cliente-del-panel', clientSecret: { from: 'pool', poolId: 'us-east-2_equipo' } };

test('en AWS lo lee del pool del equipo, una sola vez', async () => {
  const inputs: unknown[] = [];
  const secret = createClientSecretSource(fromPool, { send: async (c: unknown) => { inputs.push((c as { input: unknown }).input); return { UserPoolClient: { ClientSecret: 's3cr3t' } }; } });
  expect(await secret()).toBe('s3cr3t');
  expect(await secret()).toBe('s3cr3t');
  expect(inputs).toEqual([{ UserPoolId: 'us-east-2_equipo', ClientId: 'cliente-del-panel' }]);
});

test('un fallo pasajero no queda guardado', async () => {
  let calls = 0;
  const secret = createClientSecretSource(fromPool, { send: async () => {
    calls += 1;
    if (calls === 1) throw new Error('ThrottlingException');
    return { UserPoolClient: { ClientSecret: 's3cr3t' } };
  } });
  await expect(secret()).rejects.toThrow();
  expect(await secret()).toBe('s3cr3t');
});

test('en desarrollo sale de la variable', async () => {
  const secret = createClientSecretSource({ ...fromPool, clientSecret: { from: 'env', value: 'local' } });
  expect(await secret()).toBe('local');
});
