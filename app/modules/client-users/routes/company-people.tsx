// Las personas de una empresa: quién está, con qué rol, qué ve, sus roles y su bitácora (CA-23 de
// M2a). Lo mismo que ve su admin en «Mi equipo», más lo que soporte necesita.
import { Link, useSearchParams } from 'react-router';
import type { Route } from './+types/company-people';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Icon } from '../../../shared/icons/icon';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { invitedNotice } from '../client-user-labels';
import { CompanyDomainsCard } from '../components/company-domains-card';
import { GovernanceLogCard } from '../components/governance-log-card';
import { PeopleTable } from '../components/people-table';
import { RolesTable } from '../components/roles-table';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const people = await fromAdminApi({ request, context }, (api, token) => api.getCompanyPeople(token, params.companyId));
  const member = context.get(teamMemberContext);
  return {
    people,
    canSeeCompany: member ? can(member, 'companies', 'view') : false,
    // Invitar solo para quien puede (CA-22): esconder no protege, la ruta también lo pide.
    canInvite: member ? can(member, 'clientUsers', 'edit') : false,
  };
}

export default function CompanyPeople({ loaderData }: Route.ComponentProps) {
  const { people, canSeeCompany, canInvite } = loaderData;
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes', to: '/client-users' }, { label: people.company.name }]}
        title={`Personas de ${people.company.name}`}
        lead={<span className="mono">{people.company.id}</span>}
        actions={(canSeeCompany || canInvite) ? (
          <>
            {canSeeCompany && <Link className="btn" to={`/companies/${people.company.id}`}>Ver su ficha</Link>}
            {canInvite && <Link className="btn primary" to={`/client-users/${people.company.id}/invite`}><Icon name="plus" />Invitar persona</Link>}
          </>
        ) : undefined}
      />
      <DoneNotice text={invitedNotice(params)} />
      <PeopleTable people={people.people} roles={people.roles} />
      <div className="grid g2">
        <RolesTable roles={people.roles} />
        <GovernanceLogCard log={people.log} revoked={people.revoked} />
      </div>
      <CompanyDomainsCard domains={people.domains} counts={people.counts} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `Personas de ${loaderData?.people.company.name ?? 'una empresa'} · Panel ensō` }];
}
