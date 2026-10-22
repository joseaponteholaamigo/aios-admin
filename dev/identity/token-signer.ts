// Las claves de la identidad falsa: firma tokens RS256, como Cognito, y publica su clave pública
// en un JWKS para que el backend local los verifique con su verificador de siempre.
//
// La clave nace al arrancar `npm run dev` y vive en memoria: al reiniciar, los tokens viejos dejan
// de servir, igual que las sesiones del almacén en memoria.
import { createSign, generateKeyPairSync, randomBytes } from 'node:crypto';

export type TokenSigner = {
  sign(claims: Record<string, unknown>): string;
  jwks(): { keys: Record<string, unknown>[] };
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createTokenSigner(): TokenSigner {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `dev-${randomBytes(6).toString('hex')}`;
  return {
    sign(claims) {
      const unsigned = `${b64({ alg: 'RS256', kid, typ: 'JWT' })}.${b64(claims)}`;
      const signer = createSign('RSA-SHA256');
      signer.update(unsigned);
      return `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
    },
    jwks() {
      return { keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] };
    },
  };
}
