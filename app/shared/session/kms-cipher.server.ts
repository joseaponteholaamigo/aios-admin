// El cifrado de los tokens de sesión con KMS, por sobre (`SESSION_STORE=dynamodb`).
//
// KMS no cifra directo más de 4 KB, y los tres tokens de Cognito rondan ese tamaño. Por eso cada
// sesión pide una llave de datos (`GenerateDataKey`), cifra los tokens con ella (AES-256-GCM) y
// guarda la llave cifrada al lado. Para abrir, KMS descifra la llave: solo puede hacerlo un rol
// con `kms:Decrypt` sobre esa llave, que en el stack es solo el del panel.
//
// El contexto de cifrado ata cada llave a este uso: una llave de datos de otra cosa no abre esto.
// La llave descifrada se recuerda unos minutos para no llamar a KMS en cada pedido.
import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { openWithKey, sealWithKey } from './local-cipher.server';
import type { TokenCipher } from './types';

type Sender = { send(command: unknown): Promise<unknown> };

export const ENCRYPTION_CONTEXT = { purpose: 'aios-admin-session' };
const KEY_CACHE_MS = 5 * 60 * 1000;
const KEY_CACHE_MAX = 200;

export function createKmsCipher({ keyId, client, now = Date.now }: { keyId: string; client?: Sender; now?: () => number }): TokenCipher {
  const kms: Sender = client ?? new KMSClient({});
  const cache = new Map<string, { key: Buffer; until: number }>();

  function remember(wrapped: string, key: Buffer) {
    if (cache.size >= KEY_CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(wrapped, { key, until: now() + KEY_CACHE_MS });
  }

  async function unwrap(wrapped: string): Promise<Buffer> {
    const hit = cache.get(wrapped);
    if (hit && hit.until > now()) return hit.key;
    const r = (await kms.send(new DecryptCommand({
      KeyId: keyId,
      CiphertextBlob: Buffer.from(wrapped, 'base64url'),
      EncryptionContext: ENCRYPTION_CONTEXT,
    }))) as { Plaintext?: Uint8Array };
    if (!r.Plaintext) throw new Error('KMS no devolvió la llave de la sesión');
    const key = Buffer.from(r.Plaintext);
    remember(wrapped, key);
    return key;
  }

  return {
    async seal(plaintext) {
      const r = (await kms.send(new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: 'AES_256', EncryptionContext: ENCRYPTION_CONTEXT }))) as {
        Plaintext?: Uint8Array;
        CiphertextBlob?: Uint8Array;
      };
      if (!r.Plaintext || !r.CiphertextBlob) throw new Error('KMS no entregó una llave de datos');
      const key = Buffer.from(r.Plaintext);
      const wrapped = Buffer.from(r.CiphertextBlob).toString('base64url');
      remember(wrapped, key);
      return `${wrapped}~${sealWithKey(key, plaintext)}`;
    },
    async open(sealed) {
      const cut = sealed.indexOf('~');
      if (cut <= 0) throw new Error('Tokens de sesión con un formato que no es el esperado');
      return openWithKey(await unwrap(sealed.slice(0, cut)), sealed.slice(cut + 1));
    },
  };
}
