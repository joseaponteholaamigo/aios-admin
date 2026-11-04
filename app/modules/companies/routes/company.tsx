// La ficha de una cuenta: su plan, lo que recibe y su historia (CA-23 y CA-26 de M2a). La de una
// cuenta personal se nombra por su persona y la muestra en lugar de la parte de equipo (spec
// «Cuentas personales», CA-22).
import { Link, useSearchParams } from 'react-router';
import type { Route } from './+types/company';
import type { CompanyFile } from '../../../domain/companies';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { badgeClass, createdNotice, planLabel, statusLabel } from '../company-labels';
import { CompanyAccessCard } from '../components/company-access-card';
import { CompanyHistoryCard } from '../components/company-history-card';
import { CompanyPersonCard } from '../components/company-person-card';
import { CompanyPlanCard } from '../components/company-plan-card';

/** Cómo se llama la cuenta en su ficha: una cuenta personal, por el correo de su persona (o su id si no tiene). */
const titleOf = (file: CompanyFile) => (file.kind === 'personal' ? file.person?.email ?? file.id : file.name);

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
  const [params] = useSearchParams();
  const [plan, status] = [planLabel(file.plan), statusLabel(file)];
  const personal = file.kind === 'personal';
  const crumbs = personal
    ? [{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }, { label: 'Cuentas personales', to: '/companies?kind=personal' }]
    : [{ label: 'Administración' }, { label: 'Empresas', to: '/companies' }];
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: titleOf(file) }]}
        title={titleOf(file)}
        lead={
          <>
            <span className="mono">{file.id}</span> · {personal && <><span className="badge accent">Cuenta personal</span>{' '}</>}
            <span className={badgeClass(plan.tone)}>{plan.text}</span> <span className={badgeClass(status.tone)}>{status.text}</span>
          </>
        }
        actions={canSeePeople && !personal ? <Link className="btn" to={`/client-users/${file.id}`}>Ver sus personas</Link> : undefined}
      />
      <DoneNotice text={createdNotice(params)} />
      <div className="grid g-main">
        <div className="grid">
          <CompanyPlanCard file={file} />
          {personal && <CompanyPersonCard person={file.person} />}
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
  return [{ title: `${loaderData ? titleOf(loaderData.file) : 'Empresa'} · Panel ensō` }];
}
