// Cambiar los asientos de una empresa Personalizado (spec «Créditos por persona» de aios-tower, CA-19,
// CA-20, CB-9 y CB-10). La ruta pide «editar» en Empresas (`route-table.ts`); el backend lo vuelve a
// pedir. Al guardar vuelve a la ficha con el aviso.
import { redirect } from 'react-router';
import type { Route } from './+types/company-seats';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { seatsChangedNoticeParams, seatsEditable } from '../company-labels';
import { SeatsForm } from '../components/seats-form';
import { readSeatsChange } from '../seats-form-data';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const file = await fromAdminApi({ request, context }, (api, token) => api.getCompany(token, params.companyId));
  return { company: { id: file.id, name: file.name }, current: file.conditions?.seats ?? null, used: file.seats.used, editable: seatsEditable(file) };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const form = await request.formData();
  const values = { seats: String(form.get('seats') ?? ''), reason: String(form.get('reason') ?? '') };
  const read = readSeatsChange(form);
  if ('errors' in read) return { values, errors: read.errors, rejection: null };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeSeats(token, params.companyId, read.change));
  if (!outcome.ok) return { values, errors: {}, rejection: outcome.rejection };
  return redirect(`/companies/${encodeURIComponent(params.companyId)}?${seatsChangedNoticeParams(outcome.value)}`);
}

export default function CompanySeats({ loaderData, actionData }: Route.ComponentProps) {
  const { company, current, used, editable } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, { label: company.name, to: `/companies/${company.id}` }, { label: 'Asientos' }]}
        title={`Asientos de ${company.name}`}
        lead="Cuántas personas puede tener la empresa. Su admin invita a su gente hasta completarlos."
      />
      {editable
        ? <SeatsForm company={company} current={current} used={used} values={actionData?.values ?? null} errors={actionData?.errors ?? {}} rejection={actionData?.rejection ?? null} />
        : <p className="empty">Aquí solo se cambian los asientos de una empresa con plan Personalizado. Una cuenta personal es de una persona.</p>}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `Asientos de ${loaderData?.company.name ?? 'una empresa'} · Panel ensō` }];
}
