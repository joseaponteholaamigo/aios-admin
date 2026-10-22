// Dónde escucha el servidor del panel.
//
// En una Lambda Web Function, Lambda dice dónde escuchar en `AWS_LAMBDA_HTTP_ENDPOINT`, con la
// forma `host:puerto`, y hay que usar exactamente eso: escuchar en 127.0.0.1 o en un puerto fijo
// da `Application.TimeoutListenError` o un 502 en el primer pedido. En la Lambda clásica con Web
// Adapter, y en la máquina de quien desarrolla, la dirección sale de `PORT`.

/** El puerto local cuando no hay ninguna de las dos variables. */
export const PUERTO_LOCAL = 3000;

/**
 * @param {Record<string, string|undefined>} entorno
 * @returns {{ host: string, port: number }}
 */
export function direccionDeEscucha(entorno) {
  const deLambda = entorno.AWS_LAMBDA_HTTP_ENDPOINT?.trim();
  if (deLambda) {
    const corte = deLambda.lastIndexOf(':');
    const host = deLambda.slice(0, corte);
    const port = Number(deLambda.slice(corte + 1));
    if (corte <= 0 || !Number.isInteger(port) || port <= 0) {
      throw new Error(`AWS_LAMBDA_HTTP_ENDPOINT no tiene la forma host:puerto: «${deLambda}»`);
    }
    return { host, port };
  }
  const port = Number(entorno.PORT ?? PUERTO_LOCAL);
  if (!Number.isInteger(port) || port < 0) throw new Error(`PORT no es un puerto: «${entorno.PORT}»`);
  return { host: '127.0.0.1', port };
}
