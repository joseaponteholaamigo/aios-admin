// Quién del equipo hace el pedido: `/v1/admin/yo`, con una caché corta por persona (CA-24).
//
// La caché ahorra una llamada al backend por pedido, a cambio de que un permiso quitado o una
// suspensión tarden hasta `MEMBER_CACHE_MS` en notarse en el panel (CB-5, CB-6). El backend no
// tiene ese retraso: revisa la puerta en cada endpoint.
//
// ⚠️ La clave es el `sub` de la sesión, y la respuesta tiene que ser de ese mismo `sub`: dos
// personas a la vez nunca comparten una entrada (CA-26). Solo se guarda lo que salió bien; un
// rechazo se vuelve a preguntar en el pedido siguiente.
import type { TeamMember } from '../../domain/permissions';
import type { AdminApi, MeResult } from './admin-api.server';
import { TeamMemberContractError } from './team-member-mapping';

export const MEMBER_CACHE_MS = 30 * 1000;
/** Son tres personas: el tope solo evita que la caché crezca sin límite si algo sale mal. */
const MAX_ENTRIES = 100;

/** El actor con el que el backend nombra a una persona del equipo (`actorDe` en el backend). */
const actorOf = (sub: string) => `equipo:${sub}`;

export type TeamMemberSource = { load(sub: string, accessToken: string): Promise<MeResult> };

export function createTeamMemberSource({ api, now = Date.now }: { api: AdminApi; now?: () => number }): TeamMemberSource {
  const cache = new Map<string, { member: TeamMember; until: number }>();
  return {
    async load(sub, accessToken) {
      const hit = cache.get(sub);
      if (hit && hit.until > now()) return { kind: 'member', member: hit.member };
      cache.delete(sub);
      const result = await api.me(accessToken);
      if (result.kind !== 'member') return result;
      if (result.member.actor !== actorOf(sub)) {
        throw new TeamMemberContractError(`/yo respondió por otra persona que la de la sesión`);
      }
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(sub, { member: result.member, until: now() + MEMBER_CACHE_MS });
      return result;
    },
  };
}
