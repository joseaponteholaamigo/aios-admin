// Las reglas de acceso de una empresa Personalizado (spec «Reglas de acceso», CA-11 a CA-14): dar o quitar
// dominios y skills encima de su contenido de base, o volver a la base. La ruta pide «editar» en Empresas
// (`route-table.ts`); el backend lo vuelve a pedir. «Ver el cambio» trae la vista previa sin escribir
// nada; «Guardar» manda el mismo pedido con la confirmación y vuelve aquí con el aviso. En otro plan, la
// pantalla no ofrece el formulario: dice que primero hay que pasarla a Personalizado.
import { Link, redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/company-access';
import { targetToken, type CompanyAccessRules } from '../../../domain/access-rules';
import { planChangeBlock } from '../../../domain/plan-change';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { Icon } from '../../../shared/icons/icon';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { DoneNotice } from '../../../shared/ui/done-notice';
import {
  INTENT_FIELD, PREVIEWED_FIELD, SAVE_INTENT, accessChangeFingerprint, accessFormValues, readAccessChange, type AccessAttempt,
} from '../access-change-form-data';
import { NOT_CUSTOM_REASON, accessSavedNotice, accessSavedNoticeParams, nameLookup } from '../access-change-labels';
import { accountTitle } from '../company-labels';
import { AccessRulesCard } from '../components/access-rules-card';
import { AccessRulesEditor } from '../components/access-rules-editor';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.companyId;
  const [file, reading] = await Promise.all([
    fromAdminApi({ request, context }, (api, token) => api.getCompany(token, id)),
    fromAdminApi({ request, context }, (api, token) => api.getCompanyAccess(token, id)),
  ]);
  return { company: { id: file.id, title: accountTitle(file) }, planBlocked: planChangeBlock(file) !== null, reading };
}

export async function action({ request, context, params }: Route.ActionArgs): Promise<AccessAttempt | Response> {
  const form = await request.formData();
  const values = accessFormValues(form);
  const read = readAccessChange(form);
  if ('errors' in read) return { values, errors: read.errors, rejection: null, shown: null };
  const previewed = accessChangeFingerprint(read.change);
  // Guardar solo lo que se vio: si el pedido que llega no es el de la vista previa, se muestra la nueva y no se guarda.
  const wantsSave = form.get(INTENT_FIELD) === SAVE_INTENT;
  const stale = wantsSave && form.get(PREVIEWED_FIELD) !== previewed;
  const previewOnly = !wantsSave || stale;
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeAccess(token, params.companyId, { ...read.change, previewOnly }));
  if (!outcome.ok) return { values, errors: {}, rejection: outcome.rejection, shown: null };
  if (previewOnly) return { values, errors: {}, rejection: null, shown: { preview: outcome.value, request: read.change, previewed, stale } };
  return redirect(`/companies/${encodeURIComponent(params.companyId)}/access?${accessSavedNoticeParams(outcome.value)}`);
}

/** Las reglas de hoy en una línea: cuando cambian (se guardó, u otro las cambió), el editor arranca de cero. */
const rulesSignature = (access: CompanyAccessRules) => [access.base ?? '', ...access.rules.map((r) => `${targetToken(r.target)}=${r.action}`)].join(',');

export default function CompanyAccess({ loaderData, actionData }: Route.ComponentProps) {
  const { company, planBlocked, reading } = loaderData;
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, { label: company.title, to: `/companies/${company.id}` }, { label: 'Reglas de acceso' }]}
        title={`Reglas de acceso de ${company.title}`}
        lead="Los dominios y las skills que se le dan o se le quitan encima de su contenido de base. Primero ves el cambio; después lo guardas."
      />
      <DoneNotice text={accessSavedNotice(params)} />
      {!reading.published ? (
        <div className="banner" role="note"><Icon name="alert" /><p>No se pueden calcular sus reglas: {reading.missing ?? 'falta publicar el catálogo o la receta del plan'}.</p></div>
      ) : !reading.access.custom ? (
        <>
          <div className="banner" role="note">
            <Icon name="alert" />
            <p>
              {NOT_CUSTOM_REASON}{' '}
              {planBlocked ? '«Cambiar plan» no está disponible para esta cuenta: su ficha dice por qué.' : <Link to={`/companies/${company.id}/plan`}>Cambiar plan</Link>}
            </p>
          </div>
          <AccessRulesCard access={reading.access} names={nameLookup(reading.access.catalog)} editable={false} />
        </>
      ) : (
        <AccessRulesEditor key={rulesSignature(reading.access)} companyId={company.id} access={reading.access} attempt={actionData ?? null} />
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `Reglas de acceso de ${loaderData?.company.title ?? 'una cuenta'} · Panel ensō` }];
}
