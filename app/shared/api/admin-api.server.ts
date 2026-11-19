// El cliente de la API de administración del backend (`/v1/admin/*`).
//
// Llama con el access token de la sesión, que nunca sale del servidor del panel. Las respuestas
// se traducen al idioma del panel aquí mismo (`team-member-mapping.ts`, CA-30).
import type { TeamMember } from '../../domain/permissions';
import { toTeamMember } from './team-member-mapping';

const TIMEOUT_MS = 5000;

export type MeResult =
  | { kind: 'member'; member: TeamMember }
  /** 401 o 403: el backend no reconoce a la persona como parte activa del equipo, o no acepta el token. */
  | { kind: 'rejected'; status: 401 | 403 };

/** El backend no respondió, o respondió con un error suyo (5xx). La sesión sigue siendo válida. */
export class AdminApiUnavailableError extends Error {}

export type AdminApi = { me(accessToken: string): Promise<MeResult> };

export function createAdminApi({
  baseUrl,
  fetchImpl = fetch,
  log = (message: string) => console.warn(message),
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}): AdminApi {
  return {
    async me(accessToken) {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/v1/admin/yo`, {
          headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (cause) {
        throw new AdminApiUnavailableError('No se pudo llamar a /v1/admin/yo', { cause });
      }
      if (response.status === 401 || response.status === 403) return { kind: 'rejected', status: response.status };
      if (!response.ok) throw new AdminApiUnavailableError(`/v1/admin/yo respondió ${response.status}`);
      return { kind: 'member', member: toTeamMember(await response.json(), log) };
    },
  };
}
