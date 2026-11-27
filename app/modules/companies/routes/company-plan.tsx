// Cambiar el plan y las características de una cuenta, empresa o personal (spec «Editar cuentas y
// personas», CA-27 a CA-29). Reemplaza a «Cambiar asientos». La ruta pide «editar» en Empresas
// (`route-table.ts`); el backend lo vuelve a pedir. «Ver el cambio» trae la vista previa sin escribir
// nada; «Guardar» manda el mismo pedido con la confirmación y vuelve a la ficha con el aviso.
import { redirect } from 'react-router';
import type { Route } from './+types/company-plan';
import type { WriteRejection } from '../../../domain/account-creation';
import { lockedToCustom, planChangeBlock } from '../../../domain/plan-change';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { Icon } from '../../../shared/icons/icon';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { accountTitle } from '../company-labels';
import { PlanChangeForm, type ShownPreview } from '../components/plan-change-form';
import { INTENT_FIELD, PREVIEWED_FIELD, SAVE_INTENT, currentConditions, currentPlanChoice, planChangeFingerprint, readPlanChange } from '../plan-change-form-data';
import { PLAN_CHANGE_BLOCK_REASONS, planSavedNoticeParams } from '../plan-change-labels';
import { valuesOf, type FormValues } from '../plan-conditions-form-data';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const file = await fromAdminApi({ request, context }, (api, token) => api.getCompany(token, params.companyId));
  return {
    company: { id: file.id, title: accountTitle(file), kind: file.kind },
    current: { choice: currentPlanChoice(file), conditions: currentConditions(file) },
    block: planChangeBlock(file),
    lockedToCustom: lockedToCustom(file),
    seatsUsed: file.seats.used,
  };
}

/** Lo que vuelve al formulario: lo escrito, los errores, el rechazo y, si se pidió, la vista previa. */
type PlanAttempt = { values: FormValues; errors: Record<string, string>; rejection: WriteRejection | null; shown: ShownPreview | null };

export async function action({ request, context, params }: Route.ActionArgs): Promise<PlanAttempt | Response> {
  const form = await request.formData();
  const values = valuesOf(form);
  const read = readPlanChange(form);
  if ('errors' in read) return { values, errors: read.errors, rejection: null, shown: null };
  const previewed = planChangeFingerprint(read.change);
  // Guardar solo lo que se vio: si lo escrito cambió después de la vista previa, se muestra la nueva y no se guarda.
  const wantsSave = form.get(INTENT_FIELD) === SAVE_INTENT;
  const stale = wantsSave && form.get(PREVIEWED_FIELD) !== previewed;
  const previewOnly = !wantsSave || stale;
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changePlan(token, params.companyId, { ...read.change, previewOnly }));
  if (!outcome.ok) return { values, errors: {}, rejection: outcome.rejection, shown: null };
  if (previewOnly) return { values, errors: {}, rejection: null, shown: { preview: outcome.value, previewed, stale } };
  return redirect(`/companies/${encodeURIComponent(params.companyId)}?${planSavedNoticeParams(outcome.value)}`);
}

export default function CompanyPlan({ loaderData, actionData }: Route.ComponentProps) {
  const { company, current, block, lockedToCustom: locked, seatsUsed } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, { label: company.title, to: `/companies/${company.id}` }, { label: 'Plan' }]}
        title={`Plan de ${company.title}`}
        lead="Su plan y lo que trae: contenido, asientos, equipo compartido, horarios, fecha de fin y cupos. Primero ves el cambio; después lo guardas."
      />
      {block ? (
        <div className="banner" role="note"><Icon name="alert" /><p>Esta cuenta no cambia de plan desde aquí. {PLAN_CHANGE_BLOCK_REASONS[block]}</p></div>
      ) : (
        <PlanChangeForm
          company={company} current={current} lockedToCustom={locked} seatsUsed={seatsUsed}
          values={actionData?.values ?? null} errors={actionData?.errors ?? {}} rejection={actionData?.rejection ?? null} latest={actionData?.shown ?? null}
        />
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `Plan de ${loaderData?.company.title ?? 'una cuenta'} · Panel ensō` }];
}
