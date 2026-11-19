// La revisión de datos: lo mismo que `npm run tenant -- doctor`, solo de las empresas que el panel
// muestra (CA-23 de M2a). Va con las personas porque sus hallazgos traen correos (decisión de Jose).
import type { Route } from './+types/checkup';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { CheckupFindings } from '../components/checkup-findings';

export async function loader({ request, context }: Route.LoaderArgs) {
  return fromAdminApi({ request, context }, (api, token) => api.getDataCheckup(token));
}

export default function Checkup({ loaderData }: Route.ComponentProps) {
  const { findings, total, outsideVisible, onlySome } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes', to: '/client-users' }, { label: 'Revisión de datos' }]}
        title="Revisión de datos"
        lead="Lo que el alta, las credenciales y los asientos pueden dejar a medias. Solo reporta: nada de aquí cambia datos."
      />
      <FilterNotice onlySome={onlySome} />
      <div className="grid g2">
        <div className="card pad">
          <span className="eyebrow">Hallazgos</span>
          <h2>{total === 0 ? 'Ninguno' : total}</h2>
        </div>
        <div className="card pad">
          <span className="eyebrow">Fuera de lo que el panel muestra</span>
          <h2>{outsideVisible === 0 ? 'Ninguno' : outsideVisible}</h2>
          {outsideVisible > 0 && <p className="small muted">Se ven con <code>npm run tenant -- doctor</code>.</p>}
        </div>
      </div>
      <CheckupFindings findings={findings} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Revisión de datos · Panel ensō' }];
}
