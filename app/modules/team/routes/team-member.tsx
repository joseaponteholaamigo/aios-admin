// Una persona del equipo ENSŌ (spec «Equipo ENSŌ», CA-4, CA-17 a CA-20): sus datos, sus permisos, sus
// acciones y su historia. Solo el superadministrador; en su propia página no hay editor ni acciones:
// nadie actúa sobre sí mismo (decisión 7).
import { redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/team-member';
import { TEAM_ACTIONS, type TeamAction } from '../../../domain/team';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { badgeClass } from '../../../shared/ui/badge';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { PermissionsForm } from '../components/permissions-form';
import { TeamHistory } from '../components/team-history';
import { TeamMemberActions } from '../components/team-member-actions';
import { TeamMemberFacts } from '../components/team-member-facts';
import { INTENT_FIELD, readActionReason, readPermissionsChange } from '../team-form-data';
import { NOTICE_PARAM, displayName, noticeOf, statusLabel } from '../team-labels';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const person = await fromAdminApi({ request, context }, (api, token) => api.getTeamPerson(token, params.sub));
  const [history, team] = await Promise.all([
    fromAdminApi({ request, context }, (api, token) => api.listAuditEvents(token, { target: `equipo#${person.sub}` })),
    fromAdminApi({ request, context }, (api, token) => api.listTeam(token)),
  ]);
  const me = context.get(teamMemberContext);
  return {
    person,
    events: history.events,
    // El nombre de cada actor del equipo, para decir en la historia quién hizo cada cosa.
    names: Object.fromEntries(team.map((p) => [p.actor, displayName(p)])),
    isSelf: me?.actor === person.actor,
  };
}

const isAction = (value: unknown): value is TeamAction => TEAM_ACTIONS.includes(value as TeamAction);

export async function action({ request, context, params }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get(INTENT_FIELD);
  const done = (notice: string) => redirect(`/team/${encodeURIComponent(params.sub)}?${NOTICE_PARAM}=${notice}`);
  if (intent === 'permissions') {
    const read = readPermissionsChange(form);
    if ('errors' in read) return { intent, reasonError: read.errors.reason ?? null, rejection: null };
    const outcome = await toAdminApi({ request, context }, (api, token) => api.changeTeamPermissions(token, params.sub, read.change));
    if (!outcome.ok) return { intent, reasonError: null, rejection: outcome.rejection };
    return done('permisos');
  }
  if (!isAction(intent)) return { intent: null, reasonError: null, rejection: { code: 'invalid' as const, message: 'esa acción no existe' } };
  const reason = readActionReason(form);
  if (!reason) return { intent, reasonError: null, rejection: { code: 'invalid' as const, message: 'escribe el motivo: queda en la historia de la persona', field: 'reason' } };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.teamAction(token, params.sub, intent, reason));
  if (!outcome.ok) return { intent, reasonError: null, rejection: outcome.rejection };
  return done(intent);
}

export default function TeamMember({ loaderData, actionData }: Route.ComponentProps) {
  const { person, events, names, isSelf } = loaderData;
  const [params] = useSearchParams();
  const status = statusLabel(person);
  const permissionsAttempt = actionData?.intent === 'permissions' ? actionData : null;
  const actionAttempt = actionData && isAction(actionData.intent) ? actionData : null;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Equipo ensō', to: '/team' }, { label: displayName(person) }]}
        title={displayName(person)}
        lead={<>{person.email ?? person.sub} · <span className={badgeClass(status.tone)}>{status.text}</span></>}
      />
      <DoneNotice text={noticeOf(params)} />
      <div className="grid g-main">
        <div className="grid">
          <TeamMemberFacts person={person} />
          {isSelf && <p className="banner">Tus permisos y tu acceso los cambia otro superadministrador.</p>}
          {!isSelf && person.status !== 'retired' && (
            // `key`: el editor vuelve a nacer con los permisos guardados después de cada cambio.
            <PermissionsForm
              key={JSON.stringify([person.permissions, person.isSuperadmin])} person={person}
              reasonError={permissionsAttempt?.reasonError ?? null} rejection={permissionsAttempt?.rejection ?? null}
            />
          )}
          {!isSelf && (
            <TeamMemberActions
              key={person.status} person={person}
              rejection={actionAttempt?.rejection ?? null} rejectedAction={actionAttempt && isAction(actionAttempt.intent) ? actionAttempt.intent : null}
            />
          )}
        </div>
        <TeamHistory events={events} names={names} />
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `${loaderData ? displayName(loaderData.person) : 'Persona'} · Panel ensō` }];
}
