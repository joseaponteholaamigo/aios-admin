// Usuarios de clientes: la lista de las personas de los clientes, por correo, de a una página y con
// filtro por empresa (CA-33 de M2a), y la búsqueda de una por su correo (CA-23). La búsqueda va por POST, como el
// backend: el correo no queda en la dirección ni en el historial del navegador. El cursor de la
// lista sí viaja en la dirección, y por eso no lleva ningún correo.
import { Form, Link, useNavigation, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/client-users';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Pager } from '../../../shared/ui/pager';
import { SearchField } from '../../../shared/ui/search-field';
import { emptyListMessage } from '../client-user-labels';
import { ClientUsersTable } from '../components/client-users-table';
import { PersonResult } from '../components/person-result';

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
  if (!parsed.success) return { error: 'Escribe un correo completo, como persona@empresa.com.' as const, result: null };
  const result = await fromAdminApi({ request, context }, (api, token) => api.findPerson(token, parsed.data.email));
  return { error: null, result };
}

export default function ClientUsers({ loaderData, actionData }: Route.ComponentProps) {
  const searching = useNavigation().state === 'submitting';
  const [params] = useSearchParams();
  const company = params.get('company') ?? '';
  const withQuery = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(company ? { company } : {}), ...extra })}`;
  const { people, next, onlySome } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes' }]}
        title="Usuarios de clientes"
        lead="Las personas de los clientes: en qué empresa están, con qué rol y en qué estado. Busca una por su correo o recorre la lista."
        actions={<Link className="btn" to="/client-users/checkup">Revisión de datos</Link>}
      />
      <FilterNotice onlySome={onlySome} />
      <section className="card pad">
        <Form method="post" className="filtros" role="search">
          <SearchField inputMode="email" name="email" label="Correo de la persona" placeholder="persona@empresa.com" />
          <button type="submit" className="btn sm primary" disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
        </Form>
        {actionData?.error && <p className="badge warn" role="alert">{actionData.error}</p>}
        {actionData?.result && <PersonResult result={actionData.result} />}
      </section>
      <section className="card">
        <div className="card-h">
          <div><h2>Personas</h2><p>Por correo, las que hoy tienen un asiento: activas, invitadas o en pausa.</p></div>
          {/* `key`: al quitar el filtro, el campo vuelve a quedar vacío. */}
          <Form method="get" className="filtros" role="search" key={company}>
            <SearchField name="company" label="Filtrar por empresa" placeholder="Nombre o id de la empresa…" defaultValue={company} />
            <button type="submit" className="btn sm">Filtrar</button>
            {company && <Link className="btn sm soft" to="?">Quitar filtro</Link>}
          </Form>
        </div>
        <div className="card-b">
          <ClientUsersTable people={people} emptyMessage={emptyListMessage({ filtered: company !== '', laterPage: params.has('cursor') })} />
        </div>
        <Pager
          shown={`${people.length} persona${people.length === 1 ? '' : 's'} en esta página`}
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
  return [{ title: 'Usuarios de clientes · Panel ensō' }];
}
