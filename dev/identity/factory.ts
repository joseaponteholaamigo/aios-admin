// La identidad falsa armada con la configuración del panel. La carga `vite-plugin.ts` al arrancar
// `npm run dev`, y por eso el resto de la identidad no entra al grafo de `vite.config.ts`.
import { readConfig } from '../../app/shared/config/config.server';
import { createBackendSeeder } from './backend-seeder';
import { createDevIdentity, type DevIdentity } from './identity-provider';
import { createTokenSigner } from './token-signer';

export const DEV_IDENTITY_PATH = '/dev/identity';

/**
 * La identidad falsa, o `null` si `.env` usa otro proveedor. Se enciende solo si `COGNITO_ISSUER`
 * apunta a `/dev/identity` de un origen del panel: con un pool de Cognito de verdad en `.env`, el
 * login va a ese pool.
 */
export function devIdentityFromEnv(env: Record<string, string | undefined>): DevIdentity | null {
  const config = readConfig(env);
  const issuer = new URL(config.cognito.issuer);
  if (issuer.pathname !== DEV_IDENTITY_PATH || !config.publicOrigins.includes(issuer.origin)) return null;
  if (config.cognito.clientSecret.from !== 'env') {
    throw new Error('La identidad falsa necesita COGNITO_CLIENT_SECRET en .env, no COGNITO_POOL_ID');
  }
  return createDevIdentity({
    issuer: config.cognito.issuer,
    clientId: config.cognito.clientId,
    clientSecret: config.cognito.clientSecret.value,
    publicOrigins: config.publicOrigins,
    savePerson: createBackendSeeder({ adminApiUrl: config.adminApiUrl }),
    signer: createTokenSigner(),
  });
}
