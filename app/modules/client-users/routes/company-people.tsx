// Las personas de una empresa: quién está, con qué rol, qué ve, sus roles y su bitácora (CA-23 de
// M2a). Lo mismo que ve su admin en «Mi equipo», más lo que soporte necesita. El superadministrador
// puede además destrabarlas o borrarlas desde aquí (spec «Borrar cuentas y destrabar personas»).
import { Link, redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/company-people';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fail, fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Icon } from '../../../shared/icons/icon';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { invitedNotice } from '../client-user-labels';
import { CompanyDomainsCard } from '../components/company-domains-card';
import { GovernanceLogCard } from '../components/governance-log-card';
import { PeoplePanel } from '../components/people-panel';
import { readPersonAction } from '../person-action-form-data';
import { personActionNotice, personActionNoticeParams } from '../person-action-labels';
import { RolesTable } from '../components/roles-table';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const people = await fromAdminApi({ request, context }, (api, token) => api.getCompanyPeople(token, params.companyId));
  const member = context.get(teamMemberContext);
  return {
    people,
    canSeeCompany: member ? can(member, 'companies', 'view') : false,
    // Invitar solo para quien puede (CA-22): esconder no protege, la ruta también lo pide.
    canInvite: member ? can(member, 'clientUsers', 'edit') : false,
    // Las acciones sobre una persona, solo para el superadministrador (CA-9): el backend lo vuelve a pedir.
    canActOnPeople: member?.isSuperadmin === true,
  };
}

/** Una acción sobre una persona (CA-10 a CA-12). Al terminar vuelve aquí con el aviso; un rechazo reabre su diálogo. */
export async function action({ request, context, params }: Route.ActionArgs) {
  if (context.get(teamMemberContext)?.isSuperadmin !== true) throw fail('forbidden', 403);
  const attempt = readPersonAction(await request.formData());
  if (!attempt) return { attempt: null, rejection: { code: 'invalid' as const, message: 'el pedido no se entiende' } };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.personAction(token, params.companyId, attempt));
  if (!outcome.ok) return { attempt, rejection: outcome.rejection };
  return redirect(`/client-users/${encodeURIComponent(params.companyId)}?${personActionNoticeParams(outcome.value)}`);
}

export default function CompanyPeople({ loaderData, actionData }: Route.ComponentProps) {
  const { people, canSeeCompany, canInvite, canActOnPeople } = loaderData;
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
      <DoneNotice text={invitedNotice(params) ?? personActionNotice(params)} />
      <PeoplePanel
        people={people.people} roles={people.roles} companyName={people.company.name}
        canAct={canActOnPeople} lastAttempt={actionData ?? null}
      />
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
