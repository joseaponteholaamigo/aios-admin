// Una API de administración falsa para las pruebas de permisos: responde `/yo` según el access
// token, cuenta las llamadas y, si se le pide, tarda un número al azar de vueltas del bucle de
// eventos (sin relojes) para que los pedidos concurrentes se intercalen de verdad.
import type { TeamMember } from '../../app/domain/permissions';
import type { AdminApi, MeResult } from '../../app/shared/api/admin-api.server';

export const teamMember = (sub: string, overrides: Partial<TeamMember> = {}): TeamMember => ({
  actor: `equipo:${sub}`,
  email: `${sub}@beenso.com`,
  name: sub,
  isSuperadmin: false,
  status: 'active',
  permissions: {},
  ...overrides,
});

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

export function fakeAdminApi({ interleave = false } = {}) {
  const answers = new Map<string, MeResult>();
  let calls = 0;
  const api: AdminApi = {
    async me(accessToken) {
      calls += 1;
      if (interleave) for (let i = Math.floor(Math.random() * 5); i > 0; i--) await nextTurn();
      const answer = answers.get(accessToken);
      if (!answer) throw new Error(`La API falsa no conoce el token ${accessToken}`);
      return answer;
    },
  };
  return {
    api,
    /** Lo que responde `/yo` a ese token desde ahora. */
    answer(accessToken: string, result: MeResult) {
      answers.set(accessToken, result);
    },
    calls: () => calls,
  };
}
