// Nueva empresa o nueva cuenta personal (spec «Crear empresas e invitar personas», CA-16 a CA-21).
// `?kind=personal` abre la de cuenta personal. La ruta pide «editar» en Empresas (`route-table.ts`).
//
// Al crear, lleva a la ficha de la cuenta nueva con el aviso en la dirección (`?aviso=`), que nunca
// lleva un correo (CB-5). Un rechazo vuelve al formulario con lo escrito y la misma clave (CA-6).
import { redirect, type ShouldRevalidateFunctionArgs } from 'react-router';
import type { Route } from './+types/company-new';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { createdNoticeParams } from '../company-labels';
import { NewAccountForm } from '../components/new-account-form';
import { readNewAccount, valuesOf } from '../new-account-form-data';

export function loader({ request, context }: Route.LoaderArgs) {
  const kind = new URL(request.url).searchParams.get('kind') === 'personal' ? ('personal' as const) : ('company' as const);
  const member = context.get(teamMemberContext);
  // La clave nace con el formulario y viaja en cada reintento de este mismo formulario (CA-6, CA-21).
  return { kind, key: crypto.randomUUID(), canMove: member?.isSuperadmin === true };
}

/** Después de mandar el formulario no hace falta otra clave: la que vale es la de este formulario. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === 'POST' ? false : defaultShouldRevalidate;
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const values = valuesOf(form);
  const read = readNewAccount(form);
  if ('errors' in read) return { values, errors: read.errors, rejection: null, createdAccountId: null };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.createAccount(token, read.account));
  if (!outcome.ok) return { values, errors: {}, rejection: outcome.rejection, createdAccountId: outcome.createdAccountId };
  const { company, invitationSent, movedFrom } = outcome.value;
  return redirect(`/companies/${encodeURIComponent(company.id)}?${createdNoticeParams({ invitationSent, movedFrom })}`);
}

export default function CompanyNew({ loaderData, actionData }: Route.ComponentProps) {
  const { kind, key, canMove } = loaderData;
  const personal = kind === 'personal';
  const list = personal ? { label: 'Cuentas personales', to: '/companies?kind=personal' } : { label: 'Empresas', to: '/companies' };
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, ...(personal ? [list] : []), { label: personal ? 'Nueva cuenta personal' : 'Nueva empresa' }]}
        title={personal ? 'Nueva cuenta personal' : 'Nueva empresa'}
        lead={personal
          ? 'La cuenta de una persona sola, con su plan. La persona recibe la invitación por correo.'
          : 'La empresa, su plan y su admin. El admin recibe la invitación por correo; la license key no se muestra: cada persona entra con su correo.'}
      />
      <NewAccountForm
        kind={kind} formKey={actionData?.values.key ?? key} canMove={canMove}
        values={actionData?.values ?? null} errors={actionData?.errors ?? {}} rejection={actionData?.rejection ?? null}
        createdAccountId={actionData?.createdAccountId ?? null}
      />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `${loaderData?.kind === 'personal' ? 'Nueva cuenta personal' : 'Nueva empresa'} · Panel ensō` }];
}
