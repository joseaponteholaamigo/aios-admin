// Cómo una pantalla pide datos a la API de admin y qué hace con cada respuesta (CA-25 de M2a).
//
//   · no existe (404)          → la página dice «Esa empresa no existe o no está disponible»
//   · sin permiso (403)        → la página de permiso negado, sin tocar la sesión
//   · la sesión no sirve (401) → se borra la sesión y va a «sin acceso», igual que un rechazo de `/yo`
//   · pedido inválido (400/422)→ «Ese enlace ya no sirve» (un cursor viejo)
//   · no responde, 5xx o 429   → un error con «Volver a intentar», sin tocar la sesión
//
// Las respuestas de error van como `data(...)` lanzado: las pinta el `ErrorBoundary` de la ruta,
// dentro del marco.
import { data, redirect, type RouterContextProvider } from 'react-router';
import { sessionContext } from '../../middleware/session.server';
import { NO_ACCESS_PATH } from '../../middleware/permissions.server';
import { getSessionService } from '../session/session-service.server';
import type { SessionService } from '../session/session.server';
import { AdminApiUnavailableError } from './admin-api.server';
import { getAdminReadApi } from './admin-read-api-service.server';
import type { AdminReadApi, ApiResult } from './admin-read-api.server';
import { ApiContractError } from './api-reading';
import { TeamMemberContractError } from './team-member-mapping';

/** Por qué una pantalla no pudo cargar: lo lee `ModuleError` para decir qué pasó. */
export type ModuleErrorReason = 'not-found' | 'forbidden' | 'invalid' | 'unavailable';

const fail = (reason: ModuleErrorReason, status: number) => data({ reason }, { status });

type Deps = { api?: () => AdminReadApi; sessions?: () => SessionService; log?: (message: string) => void };

/**
 * Corre `call` con el access token de la sesión y devuelve el dato. Cualquier otra respuesta
 * **lanza** lo que la pantalla tiene que mostrar.
 */
export async function fromAdminApi<T>(
  { request, context }: { request: Request; context: Readonly<RouterContextProvider> },
  call: (api: AdminReadApi, token: string) => Promise<ApiResult<T>>,
  { api = getAdminReadApi, sessions = getSessionService, log = (m: string) => console.warn(m) }: Deps = {},
): Promise<T> {
  const session = context.get(sessionContext);
  if (!session) throw new Error('Una pantalla pidió datos sin sesión en el contexto: falta el middleware de sesión');
  let result: ApiResult<T>;
  try {
    result = await call(api(), session.tokens.accessToken);
  } catch (e) {
    if (e instanceof AdminApiUnavailableError || e instanceof ApiContractError || e instanceof TeamMemberContractError) {
      log(`La API de admin no dio una respuesta usable: ${e.message}`);
      throw fail('unavailable', 503);
    }
    throw e;
  }
  switch (result.kind) {
    case 'ok': return result.value;
    case 'not-found': throw fail('not-found', 404);
    case 'forbidden': throw fail('forbidden', 403);
    case 'invalid': throw fail('invalid', 400);
    case 'unauthorized': {
      log('La API de admin rechazó el token de la sesión (401): se cierra la sesión');
      const { cookie } = await sessions().destroy(request);
      throw redirect(NO_ACCESS_PATH, { headers: { 'Set-Cookie': cookie } });
    }
  }
}
