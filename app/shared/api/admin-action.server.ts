// Cómo una acción del panel escribe en la API de admin y qué hace con cada respuesta (spec «Crear
// empresas e invitar personas»). A diferencia de `fromAdminApi`, un rechazo no lanza: vuelve al
// formulario, para mostrarse junto a su campo.
//
//   · ok                       → `{ ok: true, value }`
//   · rechazo (409, 422, …)    → `{ ok: false, rejection }`
//   · no responde, 5xx o 429   → `{ ok: false, rejection: { code: 'unavailable' } }`
//   · sin permiso (403)        → la página de permiso negado, sin tocar la sesión
//   · la sesión no sirve (401) → se borra la sesión y va a «sin acceso»
//
// ⚠️ UN CORTE VUELVE AL FORMULARIO, NO A LA PÁGINA DE ERROR. Si la API no responde, no se sabe si
// la cuenta se creó. La página de error vuelve a pedir el formulario con una clave nueva, y entonces
// reintentar sí crearía otra. En el formulario queda la misma clave, y reintentar termina la primera.
import type { RouterContextProvider } from 'react-router';
import type { WriteRejection } from '../../domain/account-creation';
import { sessionContext } from '../../middleware/session.server';
import { getSessionService } from '../session/session-service.server';
import type { SessionService } from '../session/session.server';
import { fail, signOutToNoAccess, unusableAnswer } from './admin-loader.server';
import { getAdminWriteApi } from './admin-write-api-service.server';
import type { AdminWriteApi, WriteResult } from './admin-write-api.server';

export type WriteOutcome<T> = { ok: true; value: T } | { ok: false; rejection: WriteRejection; createdAccountId: string | null };

type Deps = { api?: () => AdminWriteApi; sessions?: () => SessionService; log?: (message: string) => void };

/** Corre `call` con el access token de la sesión. Lo que no es un dato ni un rechazo **lanza** lo que la pantalla tiene que mostrar. */
export async function toAdminApi<T>(
  { request, context }: { request: Request; context: Readonly<RouterContextProvider> },
  call: (api: AdminWriteApi, token: string) => Promise<WriteResult<T>>,
  { api = getAdminWriteApi, sessions = getSessionService, log = (m: string) => console.warn(m) }: Deps = {},
): Promise<WriteOutcome<T>> {
  const session = context.get(sessionContext);
  if (!session) throw new Error('Una acción escribió sin sesión en el contexto: falta el middleware de sesión');
  let result: WriteResult<T>;
  try {
    result = await call(api(), session.tokens.accessToken);
  } catch (e) {
    const unusable = unusableAnswer(e);
    if (!unusable) throw e;
    log(unusable);
    return { ok: false, rejection: { code: 'unavailable' }, createdAccountId: null };
  }
  switch (result.kind) {
    case 'ok': return { ok: true, value: result.value };
    case 'rejected': return { ok: false, rejection: result.rejection, createdAccountId: result.createdAccountId };
    case 'forbidden': throw fail('forbidden', 403);
    case 'unauthorized': throw await signOutToNoAccess(request, sessions, log);
  }
}
