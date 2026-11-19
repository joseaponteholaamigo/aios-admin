// Los hosts desde los que React Router acepta una *action* (`allowedActionOrigins`).
//
// React Router 8 trae su propia revisión CSRF: compara la cabecera `Origin` con el origen de
// `request.url`, y si no coinciden aborta la action con un 400. Detrás de CloudFront,
// `request.url` se arma con el Host del endpoint de Lambda, nunca con el dominio que ve el
// navegador, así que sin esta lista rechazaría TODO formulario legítimo en producción.
//
// La lista sale de `PUBLIC_ORIGINS` al arrancar (no se graba en el build, porque la dirección de
// CloudFront se conoce al desplegar). La revisión estricta, por origen exacto y para el pedido sin
// `Origin`, sigue siendo `app/middleware/csrf.server.ts`.

/**
 * @param {Record<string, string|undefined>} env
 * @returns {string[]} los hosts (`dxxxx.cloudfront.net`, `admin.beenso.com`, `localhost:5173`)
 */
export function actionOriginHosts(env) {
  return (env.PUBLIC_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).host);
}
