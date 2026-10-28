// Equipo ensō: quién del equipo entra al panel y con qué módulos (CA-23 de M2a). Solo para el
// superadministrador; cambiar permisos llega en M2b.
import type { Route } from './+types/team';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { TeamTable } from '../components/team-table';

export async function loader({ request, context }: Route.LoaderArgs) {
  return { members: await fromAdminApi({ request, context }, (api, token) => api.listTeam(token)) };
}

export default function Team({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Equipo ensō' }]}
        title="Equipo ensō"
        lead="Quién del equipo entra al panel y qué módulos puede usar. Las altas y los cambios de permisos llegan después."
      />
      <section className="card">
        <div className="card-b">
          <TeamTable members={loaderData.members} />
        </div>
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Equipo ensō · Panel ensō' }];
}
