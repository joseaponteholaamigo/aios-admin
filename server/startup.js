// El arranque del servidor en dos tiempos (CB-12): primero escucha, después prepara la app.
//
// Lambda da 10 s para empezar a escuchar, y leer la configuración de SSM puede tardar o fallar
// (por ejemplo, mientras el backend no hizo su segunda pasada). Mientras la app no está lista, cada
// pedido recibe 503. Si leer la configuración falló, el primer pedido que llega después de
// `RETRY_AFTER_MS` dispara otro intento. Si la configuración se leyó pero la app no carga (una
// variable mal escrita), no hay nada que reintentar: `onFatal` termina el proceso.

export const RETRY_AFTER_MS = 15_000;

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

  return {
    /** El primer intento, justo después de empezar a escuchar. */
    start: attempt,
    /** La app si ya está lista; si no, `null`, y dispara otro intento cuando toca. */
    handler() {
      if (handler) return handler;
      if (!inFlight && now() - lastFailureAt >= retryAfterMs) void attempt();
      return null;
    },
  };
}
