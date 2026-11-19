// Los adaptadores de AWS de la sesión: la tabla de DynamoDB y el cifrado con KMS.
//
// EL DEFECTO QUE PREVIENE. Leer la sesión sin lectura consistente dejaría usar una sesión recién
// cerrada; cifrar sin contexto dejaría abrir los tokens con cualquier llave de datos de la cuenta;
// y llamar a KMS en cada pedido lo haría lento y caro. Corren con clientes dobles, sin AWS ni red.
import { describe, expect, test } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createDynamoSessionStore } from '../app/shared/session/dynamodb-store.server';
import { ENCRYPTION_CONTEXT, createKmsCipher } from '../app/shared/session/kms-cipher.server';

type Command = { constructor: { name: string }; input: Record<string, unknown> };

describe('createDynamoSessionStore', () => {
  test('⛔ lee con lectura consistente, en su tabla y por el hash del id', async () => {
    const sent: Command[] = [];
    const store = createDynamoSessionStore({ table: 'aios-admin-sesiones', client: { send: async (c) => { sent.push(c as Command); return {}; } } });
    await store.get('hash-1');
    await store.put({ idHash: 'hash-1', sub: 's', sealedTokens: 'x', createdAt: 1, lastActivityAt: 1, expiresAt: 1 });
    await store.delete('hash-1');
    expect(sent.map((c) => c.constructor.name)).toEqual(['GetCommand', 'PutCommand', 'DeleteCommand']);
    expect(sent[0]!.input).toMatchObject({ TableName: 'aios-admin-sesiones', Key: { idHash: 'hash-1' }, ConsistentRead: true });
    expect(sent[2]!.input).toMatchObject({ TableName: 'aios-admin-sesiones', Key: { idHash: 'hash-1' } });
  });
});

/** Un KMS doble: envuelve cada llave de datos y solo la devuelve con el mismo contexto. */
function fakeKms() {
  const keys = new Map<string, Buffer>();
  let decrypts = 0;
  return {
    decrypts: () => decrypts,
    async send(command: unknown) {
      const c = command as Command;
      expect(c.input.EncryptionContext, 'una llamada a KMS sin el contexto de las sesiones').toEqual(ENCRYPTION_CONTEXT);
      if (c.constructor.name === 'GenerateDataKeyCommand') {
        const key = randomBytes(32);
        const blob = randomBytes(16);
        keys.set(blob.toString('hex'), key);
        return { Plaintext: key, CiphertextBlob: blob };
      }
      decrypts += 1;
      const key = keys.get(Buffer.from(c.input.CiphertextBlob as Uint8Array).toString('hex'));
      if (!key) throw new Error('InvalidCiphertextException');
      return { Plaintext: key };
    },
  };
}

describe('createKmsCipher', () => {
  test('cifra y descifra los tokens, y lo cifrado no los muestra', async () => {
    const cipher = createKmsCipher({ keyId: 'alias/sesiones', client: fakeKms() });
    const sealed = await cipher.seal('{"accessToken":"eyJsecreto"}');
    expect(sealed).not.toContain('eyJsecreto');
    expect(await cipher.open(sealed)).toBe('{"accessToken":"eyJsecreto"}');
  });

  test('⛔ no llama a KMS en cada pedido: la llave se recuerda cinco minutos', async () => {
    const kms = fakeKms();
    let t = 0;
    const sealed = await createKmsCipher({ keyId: 'k', client: kms }).seal('tokens');
    // Otro proceso (otro entorno de la Lambda) abre lo que cifró el primero.
    const other = createKmsCipher({ keyId: 'k', client: kms, now: () => t });
    for (let i = 0; i < 10; i++) await other.open(sealed);
    expect(kms.decrypts()).toBe(1);
    t += 5 * 60 * 1000 + 1;
    await other.open(sealed);
    expect(kms.decrypts()).toBe(2);
  });

  test('⛔ unos tokens alterados no se abren', async () => {
    const cipher = createKmsCipher({ keyId: 'k', client: fakeKms() });
    const sealed = await cipher.seal('tokens');
    await expect(cipher.open(`${sealed.slice(0, -3)}AAA`)).rejects.toThrow();
    await expect(cipher.open('sin-sobre')).rejects.toThrow(/formato/);
  });
});
