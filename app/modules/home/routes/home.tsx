// La página de inicio. En M1 muestra quién es la persona y qué módulos puede usar (CA-31).
import type { Route } from './+types/home';
import { grantedModules } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { MemberSummary } from '../components/member-summary';
import { PageHeader } from '../../../shared/layout/page-header';

/** La persona sale del contexto que dejó el middleware de permisos: aquí no se vuelve a pedir `/yo`. */
export function loader({ context }: Route.LoaderArgs) {
  const member = context.get(teamMemberContext);
  if (!member) throw new Error('La página de inicio corrió sin la persona en el contexto: falta el middleware de permisos');
  return {
    name: member.name ?? member.email ?? member.actor,
    isSuperadmin: member.isSuperadmin,
    modules: grantedModules(member),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title="Panel ensō" lead="Quién eres y qué módulos puedes usar." />
      <MemberSummary {...loaderData} />
    </>
  );
}
