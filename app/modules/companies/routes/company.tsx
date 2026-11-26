// La ficha de una cuenta: su plan, lo que recibe y su historia (CA-23 y CA-26 de M2a). La de una
// cuenta personal se nombra por su persona y la muestra en lugar de la parte de equipo (spec
// «Cuentas personales», CA-22), con lo que se le puede hacer a esa persona (spec «Editar cuentas y
// personas», CA-1). La tarjeta «Cuenta» junta lo que el equipo mira antes de cambiar algo (CA-2, CA-3), y
// «Cambiar plan» lleva a cambiar el plan y sus características, o dice por qué no se puede (CA-27). «Lo que
// recibe» lleva a sus reglas de acceso, con el mismo permiso (spec «Reglas de acceso», CA-11).
import { Link, redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/company';
import { can } from '../../../domain/permissions';
import { PERSONAL_ACCOUNT_ACTIONS } from '../../../domain/person-actions';
import { planChangeBlock } from '../../../domain/plan-change';
import { voiceCapOf, type VoiceCaps } from '../../../domain/voice-cap';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fail, fromAdminApi, fromAdminApiInBackground } from '../../../shared/api/admin-loader.server';
import { Icon } from '../../../shared/icons/icon';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { readPersonAction, type PersonActionAttempt } from '../../../shared/person-actions/person-action-form-data';
import { personActionNotice, personActionNoticeParams } from '../../../shared/person-actions/person-action-labels';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { accountTitle, badgeClass, createdNotice, planLabel, statusLabel } from '../company-labels';
import { CompanyAccessCard } from '../components/company-access-card';
import { CompanyAccountCard, type VoiceCapView } from '../components/company-account-card';
import { CompanyHistoryCard } from '../components/company-history-card';
import { CompanyPersonActions } from '../components/company-person-actions';
import { CompanyPersonCard } from '../components/company-person-card';
import { CompanyPlanCard } from '../components/company-plan-card';
import { PLAN_CHANGE_BLOCK_REASONS, planSavedNotice } from '../plan-change-labels';

/** El tope de la voz de la cuenta, o que no se pudo leer: un corte ahí no tumba la ficha entera. */
const toVoiceCapView = (read: { ok: true; value: VoiceCaps } | { ok: false }, accountId: string): VoiceCapView =>
  (read.ok ? { ok: true, cap: voiceCapOf(read.value, accountId) } : { ok: false });

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.companyId;
  const member = context.get(teamMemberContext);
  const superadmin = member?.isSuperadmin === true;
  const [file, history, voiceCaps] = await Promise.all([
    fromAdminApi({ request, context }, (api, token) => api.getCompany(token, id)),
    fromAdminApi({ request, context }, (api, token) => api.getCompanyHistory(token, id)),
    // Solo el superadministrador: a cualquier otro el backend le respondería 403 (CA-2).
    superadmin ? fromAdminApiInBackground({ request, context }, (api, token) => api.getVoiceCaps(token)) : null,
  ]);
  // El enlace a sus personas solo para quien puede abrirlas: esconder no protege, pero no tienta.
  return {
    file, history,
    canSeePeople: member ? can(member, 'clientUsers', 'view') : false,
    // Borrar la cuenta, solo el superadministrador (CA-23): la ruta también lo pide.
    canDelete: superadmin,
    // Cambiar el plan: «editar» en Empresas, el permiso que antes cambiaba los asientos (decisión 2).
    canChangePlan: member ? can(member, 'companies', 'edit') : false,
    planBlock: planChangeBlock(file),
    voiceCap: voiceCaps ? toVoiceCapView(voiceCaps, file.id) : null,
    // Destrabar a la persona de una cuenta personal, solo el superadministrador (CA-1): el backend lo vuelve a pedir.
    personActions: superadmin ? PERSONAL_ACCOUNT_ACTIONS : [],
    // Sus créditos: ver el saldo es de Consumo; cargarlos, de Empresas (spec «Créditos por persona»).
    credits: { canSee: member ? can(member, 'usage', 'view') : false, canLoad: member ? can(member, 'companies', 'edit') : false },
  };
}

/** Una acción sobre la persona de una cuenta personal (CA-1). Al terminar vuelve aquí con el aviso; un rechazo reabre su diálogo. */
export async function action({ request, context, params }: Route.ActionArgs): Promise<PersonActionAttempt | Response> {
  if (context.get(teamMemberContext)?.isSuperadmin !== true) throw fail('forbidden', 403);
  const read = readPersonAction(await request.formData(), PERSONAL_ACCOUNT_ACTIONS);
  if (!('request' in read)) return read;
  const attempt = read.request;
  const outcome = await toAdminApi({ request, context }, (api, token) => api.personAction(token, params.companyId, attempt));
  if (!outcome.ok) return { attempt, rejection: outcome.rejection };
  return redirect(`/companies/${encodeURIComponent(params.companyId)}?${personActionNoticeParams(outcome.value)}`);
}

export default function Company({ loaderData, actionData }: Route.ComponentProps) {
  const { file, history, canSeePeople, canDelete, canChangePlan, planBlock, voiceCap, personActions, credits } = loaderData;
  const [params] = useSearchParams();
  const [plan, status] = [planLabel(file.plan), statusLabel(file)];
  const personal = file.kind === 'personal';
  const hasPersonTools = personActions.length > 0 || credits.canSee || credits.canLoad;
  const crumbs = personal
    ? [{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, { label: 'Cuentas personales', to: '/companies?kind=personal' }]
    : [{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }];
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: accountTitle(file) }]}
        title={accountTitle(file)}
        lead={
          <>
            <span className="mono">{file.id}</span> · {personal && <><span className="badge accent">Cuenta personal</span>{' '}</>}
            <span className={badgeClass(plan.tone)}>{plan.text}</span> <span className={badgeClass(status.tone)}>{status.text}</span>
          </>
        }
        actions={(canSeePeople && !personal) || canDelete || canChangePlan ? (
          <>
            {canSeePeople && !personal && <Link className="btn" to={`/client-users/${file.id}`}>Ver sus personas</Link>}
            {canChangePlan && (planBlock
              ? <button type="button" className="btn" disabled aria-describedby="plan-block-reason">Cambiar plan</button>
              : <Link className="btn" to={`/companies/${file.id}/plan`}>Cambiar plan</Link>)}
            {canDelete && <Link className="btn" to={`/companies/${file.id}/delete`}>Borrar cuenta</Link>}
          </>
        ) : undefined}
      />
      {canChangePlan && planBlock && (
        <div className="banner info" role="note"><Icon name="info" /><p id="plan-block-reason">«Cambiar plan» no está disponible. {PLAN_CHANGE_BLOCK_REASONS[planBlock]}</p></div>
      )}
      <DoneNotice text={createdNotice(params) ?? planSavedNotice(params) ?? personActionNotice(params)} />
      <div className="grid g-main">
        <div className="grid">
          <CompanyPlanCard file={file} />
          {personal && (
            <CompanyPersonCard
              person={file.person}
              actions={file.person && hasPersonTools && (
                <CompanyPersonActions
                  email={file.person.email} companyId={file.id} companyName={accountTitle(file)}
                  actions={personActions} credits={credits} lastAttempt={actionData ?? null}
                />
              )}
            />
          )}
          <CompanyAccountCard file={file} voiceCap={voiceCap} />
          <CompanyAccessCard file={file} canEdit={canChangePlan} planBlocked={planBlock !== null} />
        </div>
        <CompanyHistoryCard history={history} />
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `${loaderData ? accountTitle(loaderData.file) : 'Empresa'} · Panel ensō` }];
}
