// El acceso al panel: sin sesión no se entra, y el access token se renueva en el servidor.
//
// Todo pide sesión salvo el login mismo (`/auth/*`). Si el refresh token ya no sirve (revocado,
// vencido), la sesión se cierra y se vuelve al login. Los tokens nunca llegan al navegador.
import type { MiddlewareFunction } from 'react-router';
import { sessionContext } from './session.server';
import { getLoginFlow } from '../shared/auth/login-flow-service.server';
import { loginRedirect, type LoginFlow } from '../shared/auth/login-flow.server';
import { getSessionService } from '../shared/session/session-service.server';
import type { SessionService } from '../shared/session/session.server';

const PUBLIC_PREFIX = '/auth/';

export function authMiddleware(
  flow: () => LoginFlow = getLoginFlow,
  sessions: () => SessionService = getSessionService,
): MiddlewareFunction<Response> {
  return async ({ request, context }, next) => {
    if (new URL(request.url).pathname.startsWith(PUBLIC_PREFIX)) return next();
    const session = context.get(sessionContext);
    if (!session) throw loginRedirect(request);
    const fresh = await flow().refreshIfNeeded(session);
    if (!fresh) {
      const { cookie } = await sessions().destroy(request);
      throw loginRedirect(request, { headers: { 'Set-Cookie': cookie } });
    }
    context.set(sessionContext, fresh);
    return next();
  };
}
