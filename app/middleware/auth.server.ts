// El acceso al panel: sin sesión no se entra, y el access token se renueva en el servidor.
//
// Todo pide sesión salvo las rutas que la tabla declara públicas (el login y «sin acceso»); una
// ruta que no está en la tabla también la pide. Si el refresh token ya no sirve (revocado,
// vencido), la sesión se cierra y se vuelve al login. Los tokens nunca llegan al navegador.
import { data, type MiddlewareFunction } from 'react-router';
import { sessionContext } from './session.server';
import { IdentityProviderError } from '../shared/auth/cognito-client.server';
import { getLoginFlow } from '../shared/auth/login-flow-service.server';
import { loginRedirect, type LoginFlow } from '../shared/auth/login-flow.server';
import { accessFor } from '../shared/routing/route-access';
import { getSessionService } from '../shared/session/session-service.server';
import type { SessionService } from '../shared/session/session.server';

export function authMiddleware(
  flow: () => LoginFlow = getLoginFlow,
  sessions: () => SessionService = getSessionService,
): MiddlewareFunction<Response> {
  return async ({ request, context }, next) => {
    if (accessFor(new URL(request.url)) === 'public') return next();
    const session = context.get(sessionContext);
    if (!session) throw loginRedirect(request);
    const fresh = await flow().refreshIfNeeded(session).catch((e: unknown) => {
      // Cognito no respondió y el access token ya venció: 503, con la sesión intacta para reintentar.
      if (e instanceof IdentityProviderError) throw data({ reason: 'identity-unavailable' }, { status: 503 });
      throw e;
    });
    if (!fresh) {
      const { cookie } = await sessions().destroy(request);
      throw loginRedirect(request, { headers: { 'Set-Cookie': cookie } });
    }
    context.set(sessionContext, fresh);
    return next();
  };
}
