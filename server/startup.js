// El arranque del servidor en dos tiempos (CB-12): primero escucha, después prepara la app.
//
// Lambda da 10 s para empezar a escuchar, y leer la configuración de SSM puede tardar o fallar
// (por ejemplo, mientras el backend no hizo su segunda pasada). Por eso el servidor escucha antes.
//
// Un pedido que llega mientras la app se prepara ESPERA a que termine (hasta `WAIT_FOR_READY_MS`):
// es el primer pedido después de cada rato sin uso, porque la Web Function apaga sus entornos y
// el siguiente arranca de cero. Responderle 503 hacía fallar la primera visita casi siempre.
//
// Si leer la configuración falló, el pedido recibe 503 enseguida, y el primero que llega después de
// `RETRY_AFTER_MS` dispara otro intento. Si la configuración se leyó pero la app no carga (una
// variable mal escrita), no hay nada que reintentar: `onFatal` termina el proceso.

export const RETRY_AFTER_MS = 15_000;
/** Lo máximo que un pedido espera a la app. Preparar tarda menos de un segundo; esto es margen. */
export const WAIT_FOR_READY_MS = 8_000;

/**
 * @template Handler
 * @param {{
 *   loadEnvironment: () => Promise<void>,
 *   loadApp: () => Promise<Handler>,
 *   onFatal: (error: unknown) => void,
 *   log?: (message: string) => void,
 *   now?: () => number,
 *   retryAfterMs?: number,
 * }} options
 */
export function createStartup({ loadEnvironment, loadApp, onFatal, log = console.error, now = Date.now, retryAfterMs = RETRY_AFTER_MS }) {
  /** @type {Handler|null} */
  let handler = null;
  /** @type {Promise<void>|null} */
  let inFlight = null;
  let lastFailureAt = Number.NEGATIVE_INFINITY;

  async function prepare() {
    try {
      await loadEnvironment();
    } catch (e) {
      lastFailureAt = now();
      log(`El panel todavía no tiene su configuración (${e instanceof Error ? e.message : 'error'}); se reintenta en ${retryAfterMs / 1000} s`);
      return;
    }
    try {
      handler = await loadApp();
    } catch (e) {
      onFatal(e);
    }
  }

  function attempt() {
    inFlight ??= prepare().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  /** La app si ya está lista; si no, `null`, y dispara otro intento cuando toca. */
  function current() {
    if (handler) return handler;
    if (!inFlight && now() - lastFailureAt >= retryAfterMs) void attempt();
    return null;
  }

  /**
   * La app, esperando a que termine de prepararse si está en camino. `null` si no queda lista
   * dentro de `timeoutMs`, o si leer la configuración falló: entonces el pedido recibe 503.
   *
   * @param {number} [timeoutMs]
   * @returns {Promise<Handler|null>}
   */
  async function waitForHandler(timeoutMs = WAIT_FOR_READY_MS) {
    const ready = current();
    if (ready || !inFlight) return ready;
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let timer;
    const deadline = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
    await Promise.race([inFlight, deadline]);
    clearTimeout(timer);
    return handler;
  }

  return {
    /** El primer intento, justo después de empezar a escuchar. */
    start: attempt,
    handler: current,
    waitForHandler,
  };
}
