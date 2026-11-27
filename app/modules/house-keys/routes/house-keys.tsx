// Claves de la casa: la lista de servicios (spec «Compartir referentes» de aios-tower, D14, D15 y D18; CA-29).
// Solo el superadministrador (`route-table.ts`); el backend lo vuelve a pedir. Nace con una sola fila,
// ScrapeCreators: cada servicio nuevo es una fila más y su página, sin rehacer la pantalla.
import type { Route } from './+types/house-keys';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { HouseKeysTable } from '../components/house-keys-table';

export async function loader({ request, context }: Route.LoaderArgs) {
  return { services: await fromAdminApi({ request, context }, (api, token) => api.listHouseKeys(token)) };
}

export default function HouseKeys({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Claves de la casa' }]}
        title="Claves de la casa"
        lead="Las claves con que ENSŌ paga a sus proveedores. Nunca se muestran enteras: aquí se ve si están puestas y en qué terminan, se cambian y se apaga un proveedor para todos."
      />
      <section className="card">
        <div className="card-h"><div><h2>Servicios</h2></div></div>
        <div className="card-b"><HouseKeysTable services={loaderData.services} /></div>
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Claves de la casa · Panel ensō' }];
}
