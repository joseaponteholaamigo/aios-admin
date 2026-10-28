// Gobernanza: la auditoría del equipo, de lo más nuevo a lo más viejo, toda o de un objetivo
// (CA-23 y CA-26 de M2a). El filtro y el cursor viajan en la dirección.
import { Form, useSearchParams } from 'react-router';
import type { Route } from './+types/governance';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Pager } from '../../../shared/ui/pager';
import { SearchField } from '../../../shared/ui/search-field';
import { AuditTable } from '../components/audit-table';

/** La forma de un objetivo de la auditoría: la misma regla que `eventos.js` del backend (`OBJETIVO`). */
const TARGET_FORMAT = /^[a-z]+(?:#[A-Za-z0-9._@:-]+)*$/;

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const target = url.searchParams.get('target')?.trim() || null;
  const cursor = url.searchParams.get('cursor');
  // Un filtro mal escrito no viaja: el backend respondería 422 y la página diría que el enlace venció.
  if (target && !TARGET_FORMAT.test(target)) return { events: [], next: null, onlySome: false, targetError: true };
  const page = await fromAdminApi({ request, context }, (api, token) => api.listAuditEvents(token, { target, cursor }));
  return { ...page, targetError: false };
}

export default function Governance({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const target = params.get('target') ?? '';
  const withTarget = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(target ? { target } : {}), ...extra })}`;
  const { events, next, onlySome, targetError } = loaderData;
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
        <Pager
          shown={`${events.length} evento${events.length === 1 ? '' : 's'} en esta página`}
          firstHref={params.get('cursor') ? withTarget({}) : null}
          nextHref={next ? withTarget({ cursor: next }) : null}
        />
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
