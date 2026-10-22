// Dónde escucha el servidor del panel.
//
// En una Lambda Web Function, Lambda dice dónde escuchar en `AWS_LAMBDA_HTTP_ENDPOINT`, con la
// forma `host:puerto`, y hay que usar exactamente eso: escuchar en 127.0.0.1 o en un puerto fijo
// da `Application.TimeoutListenError` o un 502 en el primer pedido. En la Lambda clásica con Web
// Adapter, y en la máquina de quien desarrolla, la dirección sale de `PORT`.

/** El puerto local cuando no hay ninguna de las dos variables. */
export const LOCAL_PORT = 3000;

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ host: string, port: number }}
 */
export function listenAddress(env) {
  const fromLambda = env.AWS_LAMBDA_HTTP_ENDPOINT?.trim();
  if (fromLambda) {
    const cut = fromLambda.lastIndexOf(':');
    const host = fromLambda.slice(0, cut);
    const port = Number(fromLambda.slice(cut + 1));
    if (cut <= 0 || !Number.isInteger(port) || port <= 0) {
      throw new Error(`AWS_LAMBDA_HTTP_ENDPOINT no tiene la forma host:puerto: «${fromLambda}»`);
    }
    return { host, port };
  }
  const port = Number(env.PORT ?? LOCAL_PORT);
  if (!Number.isInteger(port) || port < 0) throw new Error(`PORT no es un puerto: «${env.PORT}»`);
  return { host: '127.0.0.1', port };
}
