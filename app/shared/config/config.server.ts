// La configuración del servidor del panel, leída del entorno y validada una sola vez.
//
// Falla rápido y con el nombre de la variable: un panel mal configurado no arranca, en vez de
// arrancar y aceptar de más (CB-11). El archivo es `.server.ts`: nunca llega al navegador.

export type PanelConfig = {
  /**
   * Los orígenes desde los que el navegador llega al panel (`https://<id>.cloudfront.net` y, en M4,
   * `https://admin.beenso.com`). Contra esta lista se revisa `Origin` y se arma el retorno del
   * login. ⚠️ Nunca se deducen del pedido: detrás de CloudFront, el `Host` que ve el servidor es el
   * del endpoint de Lambda, no el que ve el navegador (plan §3.3).
   */
  publicOrigins: string[];
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

/** Lee y valida la configuración. **Lanza** con el nombre de la variable que falta o está mal. */
export function readConfig(env: Record<string, string | undefined>): PanelConfig {
  const raw = (env.PUBLIC_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (raw.length === 0) {
    throw new Error('Falta PUBLIC_ORIGINS: los orígenes del panel, separados por coma (https://<id>.cloudfront.net)');
  }
  return { publicOrigins: raw.map(parseOrigin) };
}

let cached: PanelConfig | null = null;

/** La configuración del proceso, leída la primera vez que se pide. */
export function getConfig(): PanelConfig {
  cached ??= readConfig(process.env);
  return cached;
}
