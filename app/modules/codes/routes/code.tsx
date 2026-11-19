// Un código de registro: qué da, quién lo canjeó y sus acciones (spec «Códigos de registro», CA-4 y
// CA-5). Ver pide «ver» en Códigos; pausar, reanudar y revocar, «editar» (CA-6); el enlace a la cuenta
// de un canje, «ver» en Empresas. El backend vuelve a revisar los permisos en cada pedido.
import { redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/code';
import { CODE_ACTIONS, type CodeAction } from '../../../domain/codes';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { badgeClass } from '../../../shared/ui/badge';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { NOTICE_PARAM, noticeOf, statusLabel } from '../code-labels';
import { REASON_MAX } from '../code-limits';
import { ACTION_FIELD, CodeActions } from '../components/code-actions';
import { CodeFacts } from '../components/code-facts';
import { RedemptionsTable } from '../components/redemptions-table';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const code = await fromAdminApi({ request, context }, (api, token) => api.getCode(token, params.code));
  const member = context.get(teamMemberContext);
  return {
    code,
    canEdit: member ? can(member, 'codes', 'edit') : false,
    canSeeAccounts: member ? can(member, 'companies', 'view') : false,
  };
}

const isAction = (value: unknown): value is CodeAction => CODE_ACTIONS.includes(value as CodeAction);

export async function action({ request, context, params }: Route.ActionArgs) {
  const form = await request.formData();
  const chosen = form.get(ACTION_FIELD);
  if (!isAction(chosen)) return { rejection: { code: 'invalid' as const, message: 'esa acción no existe' }, rejectedAction: null };
  const reason = String(form.get('reason') ?? '').trim().slice(0, REASON_MAX) || null;
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeCodeState(token, params.code, chosen, reason));
  if (!outcome.ok) return { rejection: outcome.rejection, rejectedAction: chosen };
  return redirect(`/codes/${encodeURIComponent(params.code)}?${NOTICE_PARAM}=${chosen}`);
}

export default function Code({ loaderData, actionData }: Route.ComponentProps) {
  const { code, canEdit, canSeeAccounts } = loaderData;
  const [params] = useSearchParams();
  const status = statusLabel(code);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Códigos', to: '/codes' }, { label: code.code }]}
        title={code.code}
        lead={<>{code.label} · <span className={badgeClass(status.tone)}>{status.text}</span></>}
      />
      <DoneNotice text={noticeOf(params)} />
      <div className="grid g-main">
        <div className="grid">
          <CodeFacts code={code} />
          {canEdit && <CodeActions code={code} rejection={actionData?.rejection ?? null} rejectedAction={actionData?.rejectedAction ?? null} />}
        </div>
        <RedemptionsTable redemptions={code.redemptions} canSeeAccounts={canSeeAccounts} />
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: `${loaderData?.code.code ?? 'Código'} · Panel ensō` }];
}
