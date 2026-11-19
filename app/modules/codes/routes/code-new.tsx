// Nuevo código de registro (spec «Códigos de registro», CA-1 a CA-3 y CA-7). Pide «editar» en Códigos
// (`route-table.ts`). Al crear, lleva a su detalle con el aviso; un rechazo vuelve al formulario con
// lo escrito y la misma clave.
import { redirect, type ShouldRevalidateFunctionArgs } from 'react-router';
import type { Route } from './+types/code-new';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { NOTICE_PARAM } from '../code-labels';
import { NewCodeForm } from '../components/new-code-form';
import { readNewCode, valuesOf } from '../new-code-form-data';

export function loader() {
  // La clave nace con el formulario y viaja en cada reintento de este mismo formulario (CA-7).
  return { key: crypto.randomUUID() };
}

/** Después de mandar el formulario no hace falta otra clave: la que vale es la de este formulario. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === 'POST' ? false : defaultShouldRevalidate;
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const values = valuesOf(form);
  const read = readNewCode(form);
  if ('errors' in read) return { values, errors: read.errors, rejection: null };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.createCode(token, read.code));
  if (!outcome.ok) return { values, errors: {}, rejection: outcome.rejection };
  return redirect(`/codes/${encodeURIComponent(outcome.value.code)}?${NOTICE_PARAM}=creado`);
}

export default function CodeNew({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Códigos', to: '/codes' }, { label: 'Nuevo código' }]}
        title="Nuevo código"
        lead="Lo que da a cada persona que lo use, hasta cuándo sirve y cuántas veces."
      />
      <NewCodeForm formKey={actionData?.values.key ?? loaderData.key} values={actionData?.values ?? null} errors={actionData?.errors ?? {}} rejection={actionData?.rejection ?? null} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Nuevo código · Panel ensō' }];
}
