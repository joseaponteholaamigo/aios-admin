// El secreto del cliente del panel en el pool del equipo.
//
// En AWS se lee del pool (`DescribeUserPoolClient`), con permiso solo sobre el ARN de ese pool:
// así no vive en ninguna variable de entorno ni en la plantilla (CA-35), y nadie lo copia a mano.
// Solo en desarrollo, contra la identidad falsa, sale de `COGNITO_CLIENT_SECRET`.
import { CognitoIdentityProviderClient, DescribeUserPoolClientCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { CognitoConfig } from '../config/config.server';

type Sender = { send(command: unknown): Promise<unknown> };

export function createClientSecretSource(
  config: CognitoConfig,
  client?: Sender,
): () => Promise<string> {
  const { clientSecret } = config;
  if (clientSecret.from === 'env') return async () => clientSecret.value;

  const cognito: Sender = client ?? new CognitoIdentityProviderClient({});
  let cached: Promise<string> | null = null;
  return () => {
    cached ??= (async () => {
      const r = (await cognito.send(new DescribeUserPoolClientCommand({ UserPoolId: clientSecret.poolId, ClientId: config.clientId }))) as {
        UserPoolClient?: { ClientSecret?: string };
      };
      const secret = r.UserPoolClient?.ClientSecret;
      if (!secret) throw new Error('El cliente del panel no tiene secreto en el pool del equipo');
      return secret;
    })().catch((e: unknown) => {
      cached = null; // Un fallo pasajero no queda guardado: el próximo pedido lo vuelve a intentar.
      throw e;
    });
    return cached;
  };
}
