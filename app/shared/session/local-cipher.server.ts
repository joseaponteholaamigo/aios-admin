// Cifrado de los tokens con AES-256-GCM y una llave que vive en memoria.
//
// Es la base del cifrado con KMS (que cifra con una llave de datos que KMS entrega) y, con una
// llave al azar por proceso, el cifrado de `npm run dev` y de las pruebas. GCM además autentica:
// un texto alterado no se descifra, lanza.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { TokenCipher } from './types';

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Cifra con `key` (32 bytes). El resultado es `iv.tag.texto`, en base64url. */
export function sealWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

/** Descifra lo que dio `sealWithKey`. **Lanza** si el texto fue alterado o la llave no es la misma. */
export function openWithKey(key: Buffer, sealed: string): string {
  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !body || iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Tokens de sesión con un formato que no es el esperado');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** Un cifrador con una llave al azar que muere con el proceso. Solo desarrollo y pruebas. */
export function createLocalCipher(key: Buffer = randomBytes(32)): TokenCipher {
  return {
    async seal(plaintext) {
      return sealWithKey(key, plaintext);
    },
    async open(sealed) {
      return openWithKey(key, sealed);
    },
  };
}
