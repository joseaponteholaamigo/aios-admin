// Los nombres fijos del stack del panel y lo que comparte con el backend.
//
// Los parámetros del backend los escribe `aios-backend/infra/equipo.js`: si cambian allá, cambian
// aquí. Se leen por nombre, no por exports de CloudFormation, para que un stack no frene al otro.

/** La Web Function. Cambiar el nombre reemplaza la función y, con ella, el dominio del endpoint. */
export const FUNCTION_NAME = 'aios-admin-panel';
export const ENDPOINT_NAME = 'live';

export const SESSIONS_TABLE_NAME = 'aios-admin-sessions';
export const SESSIONS_KEY_ALIAS = 'alias/aios-admin-sessions';

/** Los grupos de logs que crea Lambda para una Web Function: el central y el de cada región. */
export const LOG_GROUP_NAMES = [`/aws/lambda/web/${FUNCTION_NAME}`, `/aws/lambda/web/${FUNCTION_NAME}.local`] as const;

/** El origen público del panel (`https://<id>.cloudfront.net`): lo escribe este stack. */
export const PUBLIC_ORIGINS_PARAMETER = '/aios-admin/public-origins';

/** Lo que escribe el backend en SSM. El id del pool existe desde su primera pasada; el resto, desde la segunda. */
export const BACKEND_PARAMETERS = {
  COGNITO_POOL_ID: '/aios/equipo/pool-id',
  COGNITO_CLIENT_ID: '/aios/equipo/cliente-id',
  COGNITO_LOGIN_URL: '/aios/equipo/login-url',
  ADMIN_API_URL: '/aios/admin/api-url',
} as const;

/** Qué variable del servidor sale de qué parámetro, al arrancar (`server/runtime-config.js`). */
export const RUNTIME_PARAMETERS = { ...BACKEND_PARAMETERS, PUBLIC_ORIGINS: PUBLIC_ORIGINS_PARAMETER };

/** El tema de alarmas del backend, que ya cubre la cuenta entera. */
export const BACKEND_ALARM_TOPIC_NAME = 'aios-alarmas';
