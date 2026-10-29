// Usuarios de clientes: la lista de las personas de los clientes, por correo, de a una página y con
// filtro por empresa (CA-33 de M2a), y la búsqueda de una por su correo exacto (CA-23). Los dos
// viven en la misma barra; el resultado de la búsqueda ocupa el lugar de la lista.
//
// La búsqueda va por POST, como el backend: el correo no queda en la dirección ni en el historial
// del navegador. El filtro y el cursor de la lista sí viajan en la dirección, y por eso no llevan
// ningún correo.
import { Link, useNavigation, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/client-users';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Pager } from '../../../shared/ui/pager';
import { emptyListMessage, type ListFilter } from '../client-user-labels';
import { ClientUsersFilters } from '../components/client-users-filters';
import { ClientUsersTable } from '../components/client-users-table';
import { SearchOutcome } from '../components/search-outcome';

/**
 * La misma regla que `correoNormalizado` del backend, y no `z.email()`: esa es más estricta, y soporte
 * no podría buscar justo los correos raros que el backend sí guardó (`josé@acme.com`, `a..b@acme.com`).
 */
const EMAIL_LIKE_BACKEND = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEARCH = z.object({ email: z.string().trim().toLowerCase().regex(EMAIL_LIKE_BACKEND) });

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

export async function action({ request, context }: Route.ActionArgs) {
  const parsed = SEARCH.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: 'Escribe un correo completo, como persona@empresa.com.' as const, result: null, email: null };
  const result = await fromAdminApi({ request, context }, (api, token) => api.findPerson(token, parsed.data.email));
  return { error: null, result, email: parsed.data.email };
}

export default function ClientUsers({ loaderData, actionData }: Route.ComponentProps) {
  const searching = useNavigation().state === 'submitting';
  const [params] = useSearchParams();
  const company = params.get('company') ?? '';
  const withQuery = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(company ? { company } : {}), ...extra })}`;
  const { people, next, companies, onlySome } = loaderData;
  const chosen = companies.find((c) => c.id === company);
  const filter: ListFilter = !company ? { kind: 'all' } : chosen ? { kind: 'company', name: chosen.name } : { kind: 'unknown-company' };
  const searched = actionData?.result && actionData.email ? { result: actionData.result, email: actionData.email } : null;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes' }]}
        title="Usuarios de clientes"
        lead="Las personas de los clientes: en qué empresa están, con qué rol y en qué estado. Busca una por su correo o filtra la lista por empresa."
        actions={<Link className="btn" to="/client-users/checkup">Revisión de datos</Link>}
      />
      <FilterNotice onlySome={onlySome} />
      <section className="card">
        <div className="card-h"><div><h2>Personas</h2><p>Ordenadas por correo: las que hoy tienen un asiento (activas, invitadas o en pausa).</p></div></div>
        <ClientUsersFilters companies={companies} company={company} searching={searching} emailError={actionData?.error ?? null} />
        <div className="card-b">
          {searched
            ? <SearchOutcome result={searched.result} email={searched.email} backTo={withQuery({})} />
            : <ClientUsersTable people={people} emptyMessage={emptyListMessage(filter, params.has('cursor'))} />}
        </div>
        {!searched && (
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
