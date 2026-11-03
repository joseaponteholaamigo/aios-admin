// Usuarios de clientes: la lista de las personas de los clientes, por correo, de a una página y con
// filtro por empresa o solo por las cuentas personales (CA-33 de M2a; CA-24 de «Cuentas
// personales»), y la búsqueda por un pedazo del correo (CA-23). Los dos se aplican solos al cambiar,
// y la búsqueda ocupa el lugar de la lista mientras tiene texto.
//
// El filtro viaja en la dirección: la lista filtrada se puede recargar y compartir. El texto de la
// búsqueda va al servidor por POST, y en la barra del navegador solo después del `#`
// (`use-background-search.ts`). La página viaja por su número, que no lleva ningún correo.
import { Link, useNavigate, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/client-users';
import type { PeopleSearch } from '../../../domain/client-users';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { pageFrom } from '../../../shared/routing/page-param';
import { MAX_SEARCH_LENGTH, searchQuery, searchScope, useBackgroundSearch } from '../../../shared/search/use-background-search';
import { Pager } from '../../../shared/ui/pager';
import { emptyListMessage, type ListFilter } from '../client-user-labels';
import { clientUsersHref } from '../client-users-href';
import { ClientUsersFilters, type CompanyChoice } from '../components/client-users-filters';
import { ClientUsersTable } from '../components/client-users-table';
import { SearchResults } from '../components/search-results';

const SEARCH = z.object({ text: z.string().min(1).max(MAX_SEARCH_LENGTH), company: z.string(), kind: z.enum(['', 'personal']) });

/** Lo que responde una búsqueda que no llega al backend: sin texto, o con uno más largo que un correo. */
const NOTHING_FOUND: PeopleSearch = { people: [], hasMore: false, onlySome: true };

/** El filtro de la dirección: solo las cuentas personales, o una empresa (`?company=`). Las dos no van juntas. */
function filterFrom(params: URLSearchParams) {
  const personal = params.get('kind') === 'personal';
  return { kind: personal ? ('personal' as const) : null, company: personal ? '' : params.get('company') ?? '' };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const { company, kind } = filterFrom(url.searchParams);
  const page = pageFrom(url.searchParams);
  return fromAdminApi({ request, context }, (api, token) => api.listClientUsers(token, { company, kind, page }));
}

/** Buscar no cambia la lista: no hace falta volver a pedirla después de cada búsqueda. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === 'POST' ? false : defaultShouldRevalidate;
}

/** La búsqueda por correo. Devuelve también qué buscó, para que la pantalla descarte respuestas viejas. */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const text = searchQuery(String(form.get('text') ?? ''));
  const [company, kind] = [String(form.get('company') ?? ''), String(form.get('kind') ?? '')];
  const scope = searchScope({ company, kind });
  const parsed = SEARCH.safeParse({ text, company, kind });
  if (!parsed.success) return { text, scope, result: NOTHING_FOUND };
  const { data } = parsed;
  const result = await fromAdminApi({ request, context }, (api, token) => api.searchPeople(token, { text: data.text, company: data.company, kind: data.kind || null }));
  return { text, scope, result };
}

export default function ClientUsers({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { company, kind } = filterFrom(params);
  const search = useBackgroundSearch<PeopleSearch>({ company, kind: kind ?? '' });
  const { people, page, companies, onlySome } = loaderData;
  const chosen = companies.find((c) => c.id === company);
  const choice: CompanyChoice = kind ? { kind: 'personal' } : company ? { kind: 'company', id: company } : { kind: 'all' };
  const filter: ListFilter = kind ? { kind: 'personal' } : !company ? { kind: 'all' } : chosen ? { kind: 'company', name: chosen.name } : { kind: 'unknown-company' };
  const within = kind ? ' en las cuentas personales' : chosen ? ` de ${chosen.name}` : null;
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
          companies={companies} choice={choice} text={search.text}
          onTextChange={search.setText} onChoiceChange={(c) => navigate(clientUsersHref(c))}
          onClearAll={() => { search.setText(''); navigate('?'); }}
        />
        <div className="card-b">
          {state.kind === 'idle'
            ? <ClientUsersTable people={people} emptyMessage={emptyListMessage(filter, page)} />
            : <SearchResults state={state} query={searchQuery(search.text)} within={within} onlySome={onlySome} />}
        </div>
        {state.kind === 'idle' && (
          <Pager page={page} of={`${page.total} persona${page.total === 1 ? '' : 's'}${within ?? ''}`} hrefOf={(n) => clientUsersHref(choice, n)} />
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
