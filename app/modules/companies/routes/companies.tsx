// Empresas: la lista de las empresas que muestra la API, con búsqueda y páginas (CA-23 y CA-26 de
// M2a). La búsqueda y el cursor viajan en la dirección: cada página se puede compartir y recargar.
import { Form, useSearchParams } from 'react-router';
import type { Route } from './+types/companies';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Pager } from '../../../shared/ui/pager';
import { SearchField } from '../../../shared/ui/search-field';
import { CompaniesTable } from '../components/companies-table';

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const cursor = url.searchParams.get('cursor');
  return fromAdminApi({ request, context }, (api, token) => api.listCompanies(token, { query, cursor }));
}

export default function Companies({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const withQuery = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(query ? { q: query } : {}), ...extra })}`;
  const { companies, next, onlySome } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas' }]}
        title="Empresas"
        lead="Los clientes, con su plan, sus asientos y cuándo vence lo que pagaron. Abre una para ver su ficha y su historia."
      />
      <FilterNotice onlySome={onlySome} />
      <section className="card">
        <div className="card-h">
          <Form method="get" className="filtros" role="search">
            <SearchField name="q" label="Buscar empresa" placeholder="Nombre o id de la empresa…" defaultValue={query} />
            <button type="submit" className="btn sm">Buscar</button>
          </Form>
        </div>
        <div className="card-b">
          <CompaniesTable companies={companies} searched={query !== ''} />
        </div>
        <Pager
          shown={`${companies.length} empresa${companies.length === 1 ? '' : 's'} en esta página`}
          firstHref={params.get('cursor') ? withQuery({}) : null}
          nextHref={next ? withQuery({ cursor: next }) : null}
        />
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Empresas · Panel ensō' }];
}
