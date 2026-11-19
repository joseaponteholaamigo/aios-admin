// Dos personas a la vez no se mezclan (CA-26).
//
// EL DEFECTO QUE PREVIENE. Un servidor de Lambda atiende a varias personas en el mismo proceso.
// Si la persona del pedido viviera en una variable del módulo, o la caché de `/yo` se cruzara,
// alguien vería el panel —y los permisos— de otra persona.
import { expect, test } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { permissionsMiddleware, teamMemberContext } from '../app/middleware/permissions.server';
import { sessionContext } from '../app/middleware/session.server';
import { MEMBER_CACHE_MS, createTeamMemberSource } from '../app/shared/api/team-member-source.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { loader as homeLoader } from '../app/modules/home/routes/home';
import { fakeAdminApi, teamMember } from './helpers/fake-admin-api';
import { runMiddleware } from './helpers/run-middleware';

test('50 pedidos intercalados de dos personas: cada respuesta es de quien la pidió', async () => {
  const fake = fakeAdminApi({ interleave: true });
  fake.answer('token-ana', { kind: 'member', member: teamMember('ana', { name: 'Ana', permissions: { companies: 'edit' } }) });
  fake.answer('token-beto', { kind: 'member', member: teamMember('beto', { name: 'Beto', permissions: { usage: 'view' } }) });
  // Cada vez que la caché mira el reloj ya pasaron 30 s: los 50 pedidos llaman a `/yo` y sus
  // respuestas llegan en desorden, que es el caso en el que una mezcla se notaría.
  let clock = 0;
  const source = createTeamMemberSource({ api: fake.api, now: () => (clock += MEMBER_CACHE_MS) });
  const middleware = permissionsMiddleware({ members: () => source });

  const subs = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 'ana' : 'beto'));
  const runs = await Promise.all(
    subs.map((sub) => {
      const context = new RouterContextProvider();
      context.set(sessionContext, { id: `id-${sub}`, sub, tokens: { accessToken: `token-${sub}` }, record: {} } as unknown as ActiveSession);
      return runMiddleware(middleware, '/', context);
    }),
  );

  expect(fake.calls()).toBe(50);
  const seen = runs.map((run) => {
    const page = homeLoader({ context: run.context } as never);
    return `${run.context.get(teamMemberContext)?.actor}|${page.name}|${page.modules.map((m) => m.module).join(',')}`;
  });
  const expected = subs.map((sub) => (sub === 'ana' ? 'equipo:ana|Ana|companies' : 'equipo:beto|Beto|usage'));
  expect(seen).toEqual(expected);
});
