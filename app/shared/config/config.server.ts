// La configuración del servidor del panel, leída del entorno y validada una sola vez.
//
// Falla rápido y con el nombre de la variable: un panel mal configurado no arranca, en vez de
// arrancar y aceptar de más (CB-11). El archivo es `.server.ts`: nunca llega al navegador.

export type SessionStoreConfig =
  | { kind: 'memory' }
  | { kind: 'dynamodb'; table: string; kmsKeyId: string };

/**
 * El proveedor de identidad: el pool de Cognito del equipo o, en desarrollo, la identidad falsa,
 * que imita las mismas direcciones OIDC. El secreto del cliente sale del pool en AWS
 * (`DescribeUserPoolClient`, con `poolId`) y solo en desarrollo de una variable.
 */
export type CognitoConfig = {
  /** La base del login (`https://<prefijo>.auth.us-east-2.amazoncognito.com`). */
  loginUrl: string;
  /** El emisor de los tokens (`https://cognito-idp.us-east-2.amazonaws.com/<poolId>`). */
  issuer: string;
  clientId: string;
  clientSecret: { from: 'pool'; poolId: string } | { from: 'env'; value: string };
};

export type PanelConfig = {
  /**
   * Los orígenes desde los que el navegador llega al panel (`https://<id>.cloudfront.net` y, en M4,
   * `https://admin.beenso.com`). Contra esta lista se revisa `Origin` y se arma el retorno del
   * login. ⚠️ Nunca se deducen del pedido: detrás de CloudFront, el `Host` que ve el servidor es el
   * del endpoint de Lambda, no el que ve el navegador (plan §3.3).
   */
  publicOrigins: string[];
  /**
   * Dónde viven las sesiones. Sin valor por defecto, a propósito: en memoria, cada entorno de la
   * Lambda tendría las suyas y la gente perdería la sesión al azar; eso tiene que ser una decisión
   * escrita (`memory` solo para `npm run dev`), nunca un descuido.
   */
  sessionStore: SessionStoreConfig;
  cognito: CognitoConfig;
  /** La base de la API del backend, sin `/v1` (`https://<id>.execute-api.us-east-2.amazonaws.com`). */
  adminApiUrl: string;
};

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Valida un origen. Devuelve el origen normalizado o lanza con el motivo. */
function parseOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`PUBLIC_ORIGINS: «${value}» no es una dirección`);
  }
  if (value.replace(/\/+$/, '') !== url.origin) {
    throw new Error(`PUBLIC_ORIGINS: «${value}» lleva ruta; va solo el origen (https://<sitio>)`);
  }
  // http solo para la máquina de quien desarrolla: en cualquier otro sitio, https.
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname))) {
    throw new Error(`PUBLIC_ORIGINS: «${value}» tiene que ser https (http solo se acepta en localhost)`);
  }
  return url.origin;
}

function readSessionStore(env: Record<string, string | undefined>): SessionStoreConfig {
  const kind = env.SESSION_STORE?.trim();
  if (kind === 'memory') return { kind };
  if (kind === 'dynamodb') {
    const table = env.SESSION_TABLE?.trim();
    const kmsKeyId = env.SESSION_KMS_KEY_ID?.trim();
    if (!table) throw new Error('Falta SESSION_TABLE: la tabla de sesiones de DynamoDB');
    if (!kmsKeyId) throw new Error('Falta SESSION_KMS_KEY_ID: la llave KMS que cifra los tokens de las sesiones');
    return { kind, table, kmsKeyId };
  }
  throw new Error('Falta SESSION_STORE: «dynamodb» en AWS, «memory» solo para npm run dev');
}

function required(env: Record<string, string | undefined>, name: string, what: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}: ${what}`);
  return value;
}

/** Una URL base sin barra final; https, salvo la máquina local. */
function baseUrl(env: Record<string, string | undefined>, name: string, what: string): string {
  const value = required(env, name, what).replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name}: «${value}» no es una dirección`);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname))) {
    throw new Error(`${name}: «${value}» tiene que ser https (http solo se acepta en localhost)`);
  }
  return value;
}

function readCognito(env: Record<string, string | undefined>): CognitoConfig {
  const poolId = env.COGNITO_POOL_ID?.trim();
  const secret = env.COGNITO_CLIENT_SECRET?.trim();
  if (poolId && secret) {
    throw new Error('COGNITO_POOL_ID y COGNITO_CLIENT_SECRET son excluyentes: en AWS el secreto se lee del pool, nunca de una variable');
  }
  if (!poolId && !secret) {
    throw new Error('Falta COGNITO_POOL_ID: el pool del equipo, de donde se lee el secreto del cliente (COGNITO_CLIENT_SECRET solo en desarrollo)');
  }
  return {
    loginUrl: baseUrl(env, 'COGNITO_LOGIN_URL', 'la base del login del pool del equipo'),
    issuer: baseUrl(env, 'COGNITO_ISSUER', 'el emisor de los tokens del pool del equipo'),
    clientId: required(env, 'COGNITO_CLIENT_ID', 'el cliente del panel en el pool del equipo'),
    clientSecret: poolId ? { from: 'pool', poolId } : { from: 'env', value: secret! },
  };
}

/** Lee y valida la configuración. **Lanza** con el nombre de la variable que falta o está mal. */
export function readConfig(env: Record<string, string | undefined>): PanelConfig {
  const raw = (env.PUBLIC_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (raw.length === 0) {
    throw new Error('Falta PUBLIC_ORIGINS: los orígenes del panel, separados por coma (https://<id>.cloudfront.net)');
  }
  return {
    publicOrigins: raw.map(parseOrigin),
    sessionStore: readSessionStore(env),
    cognito: readCognito(env),
    adminApiUrl: baseUrl(env, 'ADMIN_API_URL', 'la base de la API del backend (el parámetro /aios/admin/api-url)'),
  };
}

let cached: PanelConfig | null = null;

/** La configuración del proceso, leída la primera vez que se pide. */
export function getConfig(): PanelConfig {
  cached ??= readConfig(process.env);
  return cached;
}
