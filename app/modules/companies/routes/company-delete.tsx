// Borrar una cuenta entera (spec «Borrar cuentas y destrabar personas», CA-23 a CA-27). La ruta es
// solo del superadministrador (`route-table.ts`), y el backend lo vuelve a pedir, con MFA reciente.
// Al terminar vuelve a Empresas con el aviso; un rechazo, o un borrado a medias, se queda aquí.
import { redirect } from 'react-router';
import type { Route } from './+types/company-delete';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { deletedAccountHref } from '../account-deletion-labels';
import { DeleteAccountForm } from '../components/delete-account-form';
import { DeletionSummary } from '../components/deletion-summary';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const preview = await fromAdminApi({ request, context }, (api, token) => api.getDeletionPreview(token, params.companyId));
  return { preview };
}

// Cuándo se vuelve a pedir la vista previa después de un rechazo: `delete-revalidation.ts`.
export { shouldRevalidateAfterDeletion as shouldRevalidate } from '../delete-revalidation';

export async function action({ request, context, params }: Route.ActionArgs) {
  const form = await request.formData();
  const values = { confirmation: String(form.get('confirmation') ?? ''), reason: String(form.get('reason') ?? '') };
  const deletion = { confirmation: values.confirmation, reason: values.reason.trim() || null };
  // Un corte vuelve aquí como rechazo (`unavailable`): repetir es seguro, el backend termina lo que faltó (CB-20).
  const outcome = await toAdminApi({ request, context }, (api, token) => api.deleteAccount(token, params.companyId, deletion));
  if (!outcome.ok) return { values, rejection: outcome.rejection };
  return redirect(deletedAccountHref(params.companyId, outcome.value.kind));
}

export default function CompanyDelete({ loaderData, actionData }: Route.ComponentProps) {
  const { preview } = loaderData;
  const { id, name } = preview.company;
  const title = name ?? id;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, name ? { label: title, to: `/companies/${id}` } : { label: title }, { label: 'Borrar cuenta' }]}
        title={`Borrar ${title}`}
        lead="Se borra todo lo de la cuenta: su ficha, sus personas con sus logins, lo que publicó y sus archivos. No se puede deshacer."
      />
      <DeletionSummary preview={preview} />
      <DeleteAccountForm preview={preview} values={actionData?.values ?? null} rejection={actionData?.rejection ?? null} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `Borrar ${loaderData?.preview.company.name ?? loaderData?.preview.company.id ?? 'una cuenta'} · Panel ensō` }];
}
