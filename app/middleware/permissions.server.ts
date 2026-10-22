// Los permisos de cada pedido: quién del equipo pide y si puede abrir la ruta. Niega por defecto.
//
// Corre después del acceso, así que hay sesión con un access token vigente. Pide `/yo` una vez
// por pedido (con la caché corta de la fuente) y deja a la persona en el contexto: los *loaders*
// la leen de ahí y nunca vuelven a pedirla (CA-24).
//
// - Una ruta que no está en la tabla responde 403, igual que una ruta cuyo nivel la persona no
//   tiene (CA-25).
// - Si el backend rechaza a la persona (suspendida, dada de baja, o un token que no acepta), la
//   sesión se borra y va a «sin acceso». ⚠️ Nunca de vuelta al login: con la sesión de Cognito
//   abierta, el login volvería solo y daría vueltas sin fin si el rechazo es permanente.
import { createContext, data, redirect, type MiddlewareFunction } from 'react-router';
import type { TeamMember } from '../domain/permissions';
import { sessionContext } from './session.server';
import { loginRedirect } from '../shared/auth/login-flow.server';
import { accessFor, allows } from '../shared/routing/route-access';
import { ROUTE_TABLE, type RouteEntry } from '../shared/routing/route-table';
import { getTeamMemberSource } from '../shared/api/team-member-source-service.server';
import type { TeamMemberSource } from '../shared/api/team-member-source.server';
import { getSessionService } from '../shared/session/session-service.server';
import type { SessionService } from '../shared/session/session.server';

export const teamMemberContext = createContext<TeamMember | null>(null);

export const NO_ACCESS_PATH = '/auth/no-access';

const forbidden = () => data({ reason: 'no-access' }, { status: 403 });

export function permissionsMiddleware({
  members = getTeamMemberSource,
  sessions = getSessionService,
  routes = ROUTE_TABLE,
  log = (message: string) => console.warn(message),
}: {
  members?: () => TeamMemberSource;
  sessions?: () => SessionService;
  routes?: readonly RouteEntry[];
  log?: (message: string) => void;
} = {}): MiddlewareFunction<Response> {
  return async ({ request, context }, next) => {
    const access = accessFor(new URL(request.url), routes);
    if (access === 'public') return next();
    if (!access) throw forbidden();
    const session = context.get(sessionContext);
    if (!session) throw loginRedirect(request);

    const result = await members().load(session.sub, session.tokens.accessToken);
    if (result.kind === 'rejected') {
      log(`El backend rechazó a la persona de la sesión (/yo respondió ${result.status}): se cierra la sesión`);
      const { cookie } = await sessions().destroy(request);
      throw redirect(NO_ACCESS_PATH, { headers: { 'Set-Cookie': cookie } });
    }
    if (!allows(result.member, access)) throw forbidden();
    context.set(teamMemberContext, result.member);
    return next();
  };
}
