// Volver a pedir el MFA antes de una acción reservada al superadministrador (CA-23).
//
// El backend es quien decide: si el token no trae un MFA de menos de 15 minutos, responde 401 con
// `codigo: 'mfa-reciente'`. Entonces la *action* manda a la persona al login con `acr_values` y
// `max_age`, y al volver queda en la misma página. La acción no se repite sola: la vuelve a pedir
// ella, ya con el MFA fresco.
import { loginRedirect } from './login-flow.server';

export function needsFreshMfa(status: number, body: unknown): boolean {
  return status === 401 && typeof body === 'object' && body !== null && (body as { codigo?: unknown }).codigo === 'mfa-reciente';
}

export function freshMfaRedirect(request: Request): Response {
  return loginRedirect(request, { freshMfa: true });
}
