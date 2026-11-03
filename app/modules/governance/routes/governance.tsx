// Gobernanza: la auditoría del equipo, de lo más nuevo a lo más viejo, toda o de un objetivo
// (CA-23 y CA-26 de M2a). El filtro y el número de página viajan en la dirección (spec «Paginación
// numerada», CA-8).
import { Form, useSearchParams } from 'react-router';
import type { Route } from './+types/governance';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { pageFrom, pageParam } from '../../../shared/routing/page-param';
import { singlePage } from '../../../domain/pagination';
import { Pager } from '../../../shared/ui/pager';
import { SearchField } from '../../../shared/ui/search-field';
import { AuditTable } from '../components/audit-table';

/** La forma de un objetivo de la auditoría: la misma regla que `eventos.js` del backend (`OBJETIVO`). */
const TARGET_FORMAT = /^[a-z]+(?:#[A-Za-z0-9._@:-]+)*$/;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const target = url.searchParams.get('target')?.trim() || null;
  const page = pageFrom(url.searchParams);
  // Un filtro mal escrito no viaja: el backend respondería 422 y la página diría que el enlace venció.
  if (target && !TARGET_FORMAT.test(target)) return { events: [], page: singlePage(0), onlySome: false, targetError: true };
  const result = await fromAdminApi({ request, context }, (api, token) => api.listAuditEvents(token, { target, page }));
  return { ...result, targetError: false };
}

export default function Governance({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const target = params.get('target') ?? '';
  const withTarget = (page: number) => `?${new URLSearchParams({ ...(target ? { target } : {}), ...pageParam(page) })}`;
  const { events, page, onlySome, targetError } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Gobernanza' }]}
        title="Gobernanza y auditoría"
        lead="Quién del equipo cambió qué, cuándo y por qué. Cada cambio de la API de admin queda aquí, con su motivo."
      />
      <FilterNotice onlySome={onlySome} />
      <section className="card">
        <div className="card-h">
          <Form method="get" className="filtros" role="search">
            <SearchField name="target" label="Filtrar por objetivo" placeholder="tenant#<id> o equipo#<sub>" defaultValue={target} />
            <button type="submit" className="btn sm">Filtrar</button>
          </Form>
        </div>
        <div className="card-b">
          {targetError && <p className="badge warn" role="alert">Escribe el objetivo como tenant#&lt;id&gt; o equipo#&lt;sub&gt;.</p>}
          <AuditTable events={events} />
        </div>
        <Pager page={page} of={`${page.total} evento${page.total === 1 ? '' : 's'}`} hrefOf={withTarget} />
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Gobernanza · Panel ensō' }];
}
