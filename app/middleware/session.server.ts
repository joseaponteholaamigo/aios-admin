// La sesión de cada pedido, en el contexto para los loaders, las actions y los demás middleware.
//
// Solo la lee: decidir qué pasa sin sesión (mandar al login) es del middleware de acceso. Si la
// cookie ya no sirve (sesión vencida, borrada o alterada), la borra del navegador en la respuesta.
import { createContext, type MiddlewareFunction } from 'react-router';
import type { ActiveSession, SessionService } from '../shared/session/session.server';
import { SESSION_COOKIE, expiredSessionCookie } from '../shared/session/session.server';
import { getSessionService } from '../shared/session/session-service.server';

export const sessionContext = createContext<ActiveSession | null>(null);

export function sessionMiddleware(service: () => SessionService = getSessionService): MiddlewareFunction<Response> {
  return async ({ request, context }, next) => {
    const { session, clearCookie } = await service().read(request);
    context.set(sessionContext, session);
    const response = await next();
    // ⚠️ Si la respuesta ya pone una cookie de sesión (el retorno del login crea una nueva), no
    // se agrega la vencida: el navegador aplica las dos en orden y la nueva se perdería.
    const setsSession = response.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`));
    if (!clearCookie || setsSession) return response;
    const headers = new Headers(response.headers);
    headers.append('Set-Cookie', expiredSessionCookie());
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
