// Usuarios de clientes: la lista de las personas de los clientes, por correo, de a una página y con
// filtro por empresa (CA-33 de M2a), y la búsqueda por un pedazo del correo (CA-23). Los dos se
// aplican solos al cambiar, y la búsqueda ocupa el lugar de la lista mientras tiene texto.
//
// La empresa viaja en la dirección: la lista filtrada se puede recargar y compartir. El texto de la
// búsqueda no: va por POST (`use-people-search.ts`), y el cursor de la lista no lleva ningún correo.
import { Link, useNavigate, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/client-users';
import type { PeopleSearch } from '../../../domain/client-users';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Pager } from '../../../shared/ui/pager';
import { emptyListMessage, type ListFilter } from '../client-user-labels';
import { ClientUsersFilters, MAX_SEARCH_LENGTH } from '../components/client-users-filters';
import { ClientUsersTable } from '../components/client-users-table';
import { SearchResults } from '../components/search-results';
import { searchQuery, usePeopleSearch } from '../use-people-search';

const SEARCH = z.object({ text: z.string().min(1).max(MAX_SEARCH_LENGTH), company: z.string() });

/** Lo que responde una búsqueda que no llega al backend: sin texto, o con uno más largo que un correo. */
const NOTHING_FOUND: PeopleSearch = { people: [], hasMore: false, onlySome: true };

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const company = url.searchParams.get('company') ?? '';
  const cursor = url.searchParams.get('cursor');
  return fromAdminApi({ request, context }, (api, token) => api.listClientUsers(token, { company, cursor }));
}

/** Buscar no cambia la lista: no hace falta volver a pedirla después de cada búsqueda. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === 'POST' ? false : defaultShouldRevalidate;
}

/** La búsqueda por correo. Devuelve también qué buscó, para que la pantalla descarte respuestas viejas. */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const text = searchQuery(String(form.get('text') ?? ''));
  const company = String(form.get('company') ?? '');
  const parsed = SEARCH.safeParse({ text, company });
  if (!parsed.success) return { text, company, result: NOTHING_FOUND };
  const result = await fromAdminApi({ request, context }, (api, token) => api.searchPeople(token, parsed.data));
  return { text, company, result };
}

export default function ClientUsers({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const company = params.get('company') ?? '';
  const search = usePeopleSearch(company);
  const withQuery = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(company ? { company } : {}), ...extra })}`;
  const toCompany = (id: string) => navigate(id ? `?${new URLSearchParams({ company: id })}` : '?');
  const { people, next, companies, onlySome } = loaderData;
  const chosen = companies.find((c) => c.id === company);
  const filter: ListFilter = !company ? { kind: 'all' } : chosen ? { kind: 'company', name: chosen.name } : { kind: 'unknown-company' };
  const { state } = search;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes' }]}
        title="Usuarios de clientes"
        lead="Las personas de los clientes: en qué empresa están, con qué rol y en qué estado. Busca por correo o elige una empresa: la lista cambia sola."
        actions={<Link className="btn" to="/client-users/checkup">Revisión de datos</Link>}
      />
      <FilterNotice onlySome={onlySome} />
      <section className="card">
        <div className="card-h"><div><h2>Personas</h2><p>Ordenadas por correo: las que hoy tienen un asiento (activas, invitadas o en pausa).</p></div></div>
        <ClientUsersFilters
          companies={companies} company={company} text={search.text}
          onTextChange={search.setText} onCompanyChange={toCompany}
          onClearAll={() => { search.setText(''); toCompany(''); }}
        />
        <div className="card-b">
          {state.kind === 'idle'
            ? <ClientUsersTable people={people} emptyMessage={emptyListMessage(filter, params.has('cursor'))} />
            : <SearchResults state={state} query={searchQuery(search.text)} companyName={chosen?.name ?? null} onlySome={onlySome} />}
        </div>
        {state.kind === 'idle' && (
          <Pager
            shown={`${people.length} persona${people.length === 1 ? '' : 's'}${chosen ? ` de ${chosen.name}` : ''} en esta página`}
            firstHref={params.get('cursor') ? withQuery({}) : null}
            nextHref={next ? withQuery({ cursor: next }) : null}
          />
        )}
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Usuarios de clientes · Panel ensō' }];
}
