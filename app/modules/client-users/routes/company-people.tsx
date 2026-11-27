// Las personas de una empresa: quién está, con qué rol, qué ve, sus roles y su bitácora (CA-23 de
// M2a). Lo mismo que ve su admin en «Mi equipo», más lo que soporte necesita. Desde aquí se les cambia
// el rol y se les reenvía la invitación con «editar» en Usuarios, y el superadministrador puede además
// destrabarlas, revocarlas o borrarlas (specs «Borrar cuentas y destrabar personas» y «Editar cuentas y
// personas», CA-24 a CA-26). El menú de cada persona abre «Analítica y términos» (spec «Analítica de una persona»,
// CA-10).
import { Link, redirect, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import type { Route } from './+types/company-people';
import { can } from '../../../domain/permissions';
import { actorOf, allowsPersonAction } from '../../../domain/person-actions';
import { analyticsAccessOf } from '../../../domain/person-analytics';
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
import { RolesTable } from '../components/roles-table';
import { readPersonAction, type PersonActionAttempt } from '../../../shared/person-actions/person-action-form-data';
import { personActionNotice, personActionNoticeParams } from '../../../shared/person-actions/person-action-labels';
import { isAnalyticsView } from '../../../shared/person-analytics/person-analytics-form-data';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const people = await fromAdminApi({ request, context }, (api, token) => api.getCompanyPeople(token, params.companyId));
  const member = context.get(teamMemberContext);
  return {
    people,
    canSeeCompany: member ? can(member, 'companies', 'view') : false,
    // Invitar solo para quien puede (CA-22): esconder no protege, la ruta también lo pide.
    canInvite: member ? can(member, 'clientUsers', 'edit') : false,
    // Qué puede hacerle a cada persona: cambiar el rol y reenviar con «editar» en Usuarios; lo demás, solo el
    // superadministrador (decisión 2). El backend lo vuelve a pedir.
    actor: actorOf(member),
    // Sus créditos: ver el saldo es de Consumo; cargarlos, de Empresas (spec «Créditos por persona»).
    credits: { canSee: member ? can(member, 'usage', 'view') : false, canLoad: member ? can(member, 'companies', 'edit') : false },
    // Su analítica: verla pide «ver» en Usuarios; cambiarla, «editar» (spec «Analítica de una persona», decisión 1).
    analytics: analyticsAccessOf(member),
  };
}

/** Una acción sobre una persona (CA-10 a CA-12). Al terminar vuelve aquí con el aviso; un rechazo reabre su diálogo. */
export async function action({ request, context, params }: Route.ActionArgs): Promise<PersonActionAttempt | Response> {
  const actor = actorOf(context.get(teamMemberContext));
  // Quien no puede hacer ninguna, ni se lee el formulario.
  if (!actor.superadmin && !actor.editUsers) throw fail('forbidden', 403);
  const read = readPersonAction(await request.formData());
  if (!('request' in read)) return read;
  if (!allowsPersonAction(actor, read.request.action)) throw fail('forbidden', 403);
  const attempt = read.request;
  const outcome = await toAdminApi({ request, context }, (api, token) => api.personAction(token, params.companyId, attempt));
  if (!outcome.ok) return { attempt, rejection: outcome.rejection };
  return redirect(`/client-users/${encodeURIComponent(params.companyId)}?${personActionNoticeParams(outcome.value)}`);
}

/** Ver la analítica de una persona solo lee: la página no se vuelve a pedir por eso. Cambiarla sí, por su bitácora. */
export function shouldRevalidate({ formData, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return isAnalyticsView(formData) ? false : defaultShouldRevalidate;
}

export default function CompanyPeople({ loaderData, actionData }: Route.ComponentProps) {
  const { people, canSeeCompany, canInvite, actor, credits, analytics } = loaderData;
  const [params] = useSearchParams();
  const personal = people.company.kind === 'personal';
  // Una cuenta personal es de una persona: no se invita a nadie más (spec «Editar cuentas y personas», CA-6).
  const showInvite = canInvite && !personal;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes', to: '/client-users' }, { label: people.company.name }]}
        title={`Personas de ${people.company.name}`}
        lead={<span className="mono">{people.company.id}</span>}
        actions={(canSeeCompany || showInvite) ? (
          <>
            {canSeeCompany && <Link className="btn" to={`/companies/${people.company.id}`}>Ver su ficha</Link>}
            {showInvite && <Link className="btn primary" to={`/client-users/${people.company.id}/invite`}><Icon name="plus" />Invitar persona</Link>}
          </>
        ) : undefined}
      />
      <DoneNotice text={invitedNotice(params) ?? personActionNotice(params)} />
      <PeoplePanel
        people={people.people} roles={people.roles} companyId={people.company.id} companyName={people.company.name}
        personal={personal}
        actor={actor} lastAttempt={actionData ?? null} credits={credits} analytics={analytics}
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
