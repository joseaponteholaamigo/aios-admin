// La configuración que el panel lee de SSM al arrancar, en AWS (CB-12, CA-35).
//
// Los ids del pool del equipo, su login y la URL de la API los escribe el backend en SSM, y el
// origen público de CloudFront lo escribe el stack del panel. El stack le dice al servidor qué
// variable sale de qué parámetro (`PANEL_SSM_PARAMETERS`, en JSON), y el servidor los lee después
// de empezar a escuchar. Sin esa variable (en la máquina de quien desarrolla) no se lee nada.
//
// Por qué al arrancar y no al desplegar: la revisión de la Web Function no puede depender de la
// distribución de CloudFront, que a su vez depende del endpoint de la revisión. Y así el panel
// toma solo los parámetros que el backend escribe en su segunda pasada, sin volver a desplegarse.
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

/** SSM devuelve como mucho 10 parámetros por pedido. */
const MAX_PARAMETERS = 10;
const TIMEOUT_MS = 3000;
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * Completa `AWS_REGION` con `PANEL_REGION` si falta. Los SDK toman la región de `AWS_REGION`, que
 * Lambda reserva y debería poner; si una Web Function no la recibiera, el stack pasa la suya.
 * ⚠️ `process.env` convierte todo a texto: asignarle `undefined` dejaría la cadena "undefined".
 *
 * @param {Record<string, string|undefined>} env
 */
export function ensureRegion(env) {
  if (!env.AWS_REGION && env.PANEL_REGION) env.AWS_REGION = env.PANEL_REGION;
}

/** Falta algún parámetro (el backend todavía no hizo su segunda pasada) o SSM no respondió. Se reintenta. */
export class RuntimeConfigUnavailableError extends Error {}

/**
 * Qué variable de entorno sale de qué parámetro de SSM, o `null` si no hay que leer nada.
 * **Lanza** si `PANEL_SSM_PARAMETERS` no es un objeto de `VARIABLE` → `/parámetro`.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {Record<string, string>|null}
 */
export function ssmParameterMap(env) {
  const raw = env.PANEL_SSM_PARAMETERS?.trim();
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('PANEL_SSM_PARAMETERS no es JSON');
  }
  const entries = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.entries(parsed) : [];
  const valid = entries.length > 0 && entries.length <= MAX_PARAMETERS
    && entries.every(([variable, name]) => VARIABLE_NAME.test(variable) && typeof name === 'string' && name.startsWith('/'));
  if (!valid) throw new Error(`PANEL_SSM_PARAMETERS tiene que ser un objeto de VARIABLE → /parámetro, con 1 a ${MAX_PARAMETERS} entradas`);
  return Object.fromEntries(entries);
}

/**
 * Lee los parámetros y devuelve las variables que salen de ellos. **Lanza**
 * `RuntimeConfigUnavailableError` si SSM no responde o si falta alguno.
 *
 * @param {Record<string, string>} map
 * @param {{ send: (command: GetParametersCommand, options?: { abortSignal?: AbortSignal }) => Promise<{ Parameters?: { Name?: string, Value?: string }[] }> }} client
 * @returns {Promise<Record<string, string>>}
 */
export async function readSsmParameters(map, client = new SSMClient({})) {
  const names = [...new Set(Object.values(map))];
  let response;
  try {
    response = await client.send(new GetParametersCommand({ Names: names }), { abortSignal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new RuntimeConfigUnavailableError(`SSM no respondió: ${e instanceof Error ? e.name : 'error'}`);
  }
  const values = new Map((response.Parameters ?? []).map((p) => [p.Name, p.Value]));
  const missing = names.filter((name) => !values.get(name));
  if (missing.length > 0) throw new RuntimeConfigUnavailableError(`Faltan parámetros de SSM: ${missing.join(', ')}`);
  return Object.fromEntries(Object.entries(map).map(([variable, name]) => [variable, /** @type {string} */ (values.get(name))]));
}
