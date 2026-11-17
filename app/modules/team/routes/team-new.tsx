// Nueva persona del equipo ENSŌ (spec «Equipo ENSŌ», CA-15). Solo el superadministrador
// (`route-table.ts`). Al crear, lleva a su página con el aviso; un rechazo vuelve al formulario con
// lo escrito, sus permisos y la misma clave.
import { redirect, type ShouldRevalidateFunctionArgs } from 'react-router';
import type { Route } from './+types/team-new';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { NewTeamMemberForm } from '../components/new-team-member-form';
import { SUPERADMIN_FIELD, readNewTeamMember, readPermissions, valuesOf } from '../team-form-data';
import { NOTICE_PARAM } from '../team-labels';

export function loader() {
  // La clave nace con el formulario y viaja en cada reintento de este mismo formulario (CA-2).
  return { key: crypto.randomUUID() };
}

/** Después de mandar el formulario no hace falta otra clave: la que vale es la de este formulario. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === 'POST' ? false : defaultShouldRevalidate;
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const kept = { values: valuesOf(form), permissions: readPermissions(form), isSuperadmin: form.get(SUPERADMIN_FIELD) === '1' };
  const read = readNewTeamMember(form);
  if ('errors' in read) return { ...kept, errors: read.errors, rejection: null };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.createTeamMember(token, read.member));
  if (!outcome.ok) return { ...kept, errors: {}, rejection: outcome.rejection };
  const notice = outcome.value.accountWasNew ? 'creada' : 'creada-ya-existia';
  return redirect(`/team/${encodeURIComponent(outcome.value.person.sub)}?${NOTICE_PARAM}=${notice}`);
}

export default function TeamNew({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Equipo ensō', to: '/team' }, { label: 'Nueva persona' }]}
        title="Nueva persona"
        lead="Alguien del equipo ENSŌ que va a entrar al panel, y a qué módulos."
      />
      <NewTeamMemberForm
        formKey={actionData?.values.key ?? loaderData.key}
        values={actionData?.values ?? null}
        permissions={actionData?.permissions ?? {}}
        isSuperadmin={actionData?.isSuperadmin ?? false}
        errors={actionData?.errors ?? {}}
        rejection={actionData?.rejection ?? null}
      />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Nueva persona · Panel ensō' }];
}
