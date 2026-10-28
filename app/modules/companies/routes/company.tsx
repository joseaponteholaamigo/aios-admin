// La ficha de una empresa: su plan, lo que recibe y su historia (CA-23 y CA-26 de M2a).
import { Link } from 'react-router';
import type { Route } from './+types/company';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { badgeClass, planLabel, statusLabel } from '../company-labels';
import { CompanyAccessCard } from '../components/company-access-card';
import { CompanyHistoryCard } from '../components/company-history-card';
import { CompanyPlanCard } from '../components/company-plan-card';

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const id = params.companyId;
  const [file, history] = await Promise.all([
    fromAdminApi({ request, context }, (api, token) => api.getCompany(token, id)),
    fromAdminApi({ request, context }, (api, token) => api.getCompanyHistory(token, id)),
  ]);
  const member = context.get(teamMemberContext);
  // El enlace a sus personas solo para quien puede abrirlas: esconder no protege, pero no tienta.
  return { file, history, canSeePeople: member ? can(member, 'clientUsers', 'view') : false };
}

export default function Company({ loaderData }: Route.ComponentProps) {
  const { file, history, canSeePeople } = loaderData;
  const [plan, status] = [planLabel(file.plan), statusLabel(file)];
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, { label: file.name }]}
        title={file.name}
        lead={
          <>
            <span className="mono">{file.id}</span> · <span className={badgeClass(plan.tone)}>{plan.text}</span>{' '}
            <span className={badgeClass(status.tone)}>{status.text}</span>
          </>
        }
        actions={canSeePeople ? <Link className="btn" to={`/client-users/${file.id}`}>Ver sus personas</Link> : undefined}
      />
      <div className="grid g-main">
        <div className="grid">
          <CompanyPlanCard file={file} />
          <CompanyAccessCard file={file} />
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
  return [{ title: `${loaderData?.file.name ?? 'Empresa'} · Panel ensō` }];
}
