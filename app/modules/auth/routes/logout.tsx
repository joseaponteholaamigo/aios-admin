// `/auth/logout`: cierra la sesión. Solo por POST, que pasa por la protección CSRF: un enlace
// en otra página no puede sacar a nadie del panel.
import { redirect } from 'react-router';
import type { Route } from './+types/logout';
import { getLoginFlow } from '../../../shared/auth/login-flow-service.server';

export async function action({ request }: Route.ActionArgs) {
  return getLoginFlow().logout(request);
}

export function loader() {
  return redirect('/');
}
