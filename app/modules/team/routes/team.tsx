// Equipo ensō: quién del equipo entra al panel, con qué módulos y cómo va su invitación (spec M2a,
// CA-23; spec «Equipo ENSŌ», CA-14). Solo para el superadministrador. Las retiradas van aparte, al
// final: ya no entran, pero su nombre sigue en la historia.
import { Link, useSearchParams } from 'react-router';
import type { Route } from './+types/team';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { TeamTable } from '../components/team-table';
import { noticeOf } from '../team-labels';

export async function loader({ request, context }: Route.LoaderArgs) {
  const people = await fromAdminApi({ request, context }, (api, token) => api.listTeam(token));
  return { current: people.filter((p) => p.status !== 'retired'), retired: people.filter((p) => p.status === 'retired') };
}

export default function Team({ loaderData }: Route.ComponentProps) {
  const { current, retired } = loaderData;
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Equipo ensō' }]}
        title="Equipo ensō"
        lead="Quién del equipo entra al panel y qué puede hacer. Abre a una persona para cambiar sus permisos, suspenderla o restablecer su MFA."
        actions={<Link className="btn primary" to="/team/new">Nueva persona</Link>}
      />
      <DoneNotice text={noticeOf(params)} />
      <section className="card">
        <div className="card-b"><TeamTable people={current} empty="Todavía no hay nadie en el equipo." /></div>
      </section>
      {retired.length > 0 && (
        <section className="card">
          <div className="card-h"><div><h2>Retiradas</h2><p>Ya no entran al panel. Su historia queda.</p></div></div>
          <div className="card-b"><TeamTable people={retired} empty="" /></div>
        </section>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Equipo ensō · Panel ensō' }];
}
