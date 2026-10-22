// `/auth/login`: empieza el ingreso y manda a la persona al login de Cognito.
// `?returnTo=/ruta` dice a dónde volver; `?mfa=1` vuelve a pedir el código (acciones reservadas).
import type { Route } from './+types/login';
import { getLoginFlow } from '../../../shared/auth/login-flow-service.server';

export async function loader({ request }: Route.LoaderArgs) {
  return getLoginFlow().startLogin(request);
}
