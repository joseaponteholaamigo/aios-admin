// Códigos de registro: la lista (spec «Códigos de registro», CA-4). Pide «ver» en Códigos; crear,
// «editar» (CA-6). El backend vuelve a revisar los permisos en cada pedido.
import { Link, useSearchParams } from 'react-router';
import type { Route } from './+types/codes';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { noticeOf } from '../code-labels';
import { CodesTable } from '../components/codes-table';

export async function loader({ request, context }: Route.LoaderArgs) {
  const codes = await fromAdminApi({ request, context }, (api, token) => api.listCodes(token));
  const member = context.get(teamMemberContext);
  return { codes, canCreate: member ? can(member, 'codes', 'edit') : false };
}

export default function Codes({ loaderData }: Route.ComponentProps) {
  const { codes, canCreate } = loaderData;
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Códigos' }]}
        title="Códigos de registro"
        lead="Un código se reparte en un webinar, un correo o una publicación: cada persona nueva que lo usa se registra en ENSŌ y queda con su cuenta personal en Pro."
        actions={canCreate ? <Link className="btn primary" to="/codes/new">Nuevo código</Link> : undefined}
      />
      <DoneNotice text={noticeOf(params)} />
      <section className="card">
        <div className="card-b"><CodesTable codes={codes} /></div>
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Códigos · Panel ensō' }];
}
