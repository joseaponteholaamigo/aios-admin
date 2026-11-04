// Invitar a una persona a una cuenta (spec «Crear empresas e invitar personas», CA-22). La ruta pide
// «editar» en Usuarios de clientes (`route-table.ts`). Al invitar, vuelve a las personas de la
// cuenta con el aviso en la dirección, que nunca lleva el correo (CB-5).
import { redirect } from 'react-router';
import type { Route } from './+types/invite-person';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { invitedNoticeParams } from '../client-user-labels';
import { InvitePersonForm } from '../components/invite-person-form';
import { readNewPerson, valuesOf } from '../invite-person-form-data';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const people = await fromAdminApi({ request, context }, (api, token) => api.getCompanyPeople(token, params.companyId));
  const member = context.get(teamMemberContext);
  return { company: people.company, roles: people.roles, canMove: member?.isSuperadmin === true };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const form = await request.formData();
  const values = valuesOf(form);
  const read = readNewPerson(form);
  if ('errors' in read) return { values, errors: read.errors, rejection: null };
  // Un corte vuelve aquí como rechazo (`unavailable`): invitar otra vez dice si ya estaba (`ya-tiene-asiento`).
  const outcome = await toAdminApi({ request, context }, (api, token) => api.invitePerson(token, params.companyId, read.person));
  if (!outcome.ok) return { values, errors: {}, rejection: outcome.rejection };
  return redirect(`/client-users/${encodeURIComponent(params.companyId)}?${invitedNoticeParams(outcome.value)}`);
}

export default function InvitePerson({ loaderData, actionData }: Route.ComponentProps) {
  const { company, roles, canMove } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes', to: '/client-users' }, { label: company.name, to: `/client-users/${company.id}` }, { label: 'Invitar persona' }]}
        title={`Invitar a ${company.name}`}
        lead="La persona recibe la invitación por correo y entra a ENSŌ con ese correo. Las reglas son las de «Mi equipo»: el cupo de asientos y los roles de la cuenta."
      />
      <InvitePersonForm
        company={company} roles={roles} canMove={canMove}
        values={actionData?.values ?? null} errors={actionData?.errors ?? {}} rejection={actionData?.rejection ?? null}
      />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `Invitar a ${loaderData?.company.name ?? 'una cuenta'} · Panel ensō` }];
}
