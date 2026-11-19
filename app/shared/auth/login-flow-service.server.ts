// El flujo de login del proceso, armado con la configuración.
import { getConfig } from '../config/config.server';
import { getSessionInfrastructure, getSessionService } from '../session/session-service.server';
import { createCognitoClient } from './cognito-client.server';
import { createClientSecretSource } from './client-secret.server';
import { createPendingLogins } from './pending-login.server';
import { createLoginFlow, type LoginFlow } from './login-flow.server';

let flow: LoginFlow | null = null;

export function getLoginFlow(): LoginFlow {
  if (flow) return flow;
  const config = getConfig();
  flow = createLoginFlow({
    config,
    cognito: createCognitoClient({ config: config.cognito, clientSecret: createClientSecretSource(config.cognito) }),
    pending: createPendingLogins(getSessionInfrastructure()),
    sessions: getSessionService(),
  });
  return flow;
}
