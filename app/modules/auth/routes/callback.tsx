// `/auth/callback`: el retorno desde Cognito. Si todo cuadra, crea la sesión y vuelve a donde la
// persona estaba; si no, muestra por qué sin detalles técnicos y no crea nada (CB-2).
import { data } from 'react-router';
import type { Route } from './+types/callback';
import { getLoginFlow } from '../../../shared/auth/login-flow-service.server';

export async function loader({ request }: Route.LoaderArgs) {
  const result = await getLoginFlow().finishLogin(request);
  if (result.ok) return result.response;
  return data({ message: result.message }, { status: result.status, headers: result.headers });
}

export default function Callback({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <h1>No pudimos completar el ingreso</h1>
      <p>{loaderData.message}</p>
      <a href="/auth/login">Volver a entrar</a>
    </main>
  );
}
