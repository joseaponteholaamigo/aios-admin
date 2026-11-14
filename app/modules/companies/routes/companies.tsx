// Empresas: las cuentas de los clientes en dos pestañas, las empresas y las cuentas personales (spec
// «Cuentas personales», CA-18 a CA-21), con búsqueda y páginas (CA-23 y CA-26 de M2a). Los filtros se
// aplican solos, como en Usuarios de clientes, y la búsqueda ocupa el lugar de la lista mientras tiene
// texto.
//
// Las dos pestañas leen de lugares distintos:
//   · Empresas: la lista de siempre (`/v1/admin/clientes`), por nombre, con filtro de plan y números de
//     página (spec «Paginación numerada», CA-8).
//   · Cuentas personales: el índice de cuentas (`/v1/admin/cuentas`, spec «Registro abierto» de
//     aios-tower, CA-23 y CA-24), de la más nueva a la más vieja, con sus números por origen y un cursor.
//     Con el registro abierto son miles: cada página es una sola consulta, nunca un recorrido.
//
// La pestaña, el plan, la página y el cursor viajan en la dirección: cada página se puede compartir y
// recargar. El texto va al servidor por POST, y en la barra del navegador solo después del `#`
// (`use-background-search.ts`): en las cuentas personales se busca por correo.
import { Link, redirect, useNavigate, useSearchParams, type RouterContextProvider, type ShouldRevalidateFunctionArgs } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/companies';
import { LIST_PLANS, isListPlan, type AccountKind, type CompaniesSearch, type ListPlan } from '../../../domain/companies';
import { isCursor } from '../../../domain/pagination';
import { can } from '../../../domain/permissions';
import { teamMemberContext } from '../../../middleware/permissions.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Icon } from '../../../shared/icons/icon';
import { pageFrom } from '../../../shared/routing/page-param';
import { MAX_SEARCH_LENGTH, searchQuery, searchScope, useBackgroundSearch } from '../../../shared/search/use-background-search';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { Pager } from '../../../shared/ui/pager';
import { deletedNotice } from '../account-deletion-labels';
import { AFTER_PARAM, companiesHref } from '../companies-href';
import { countOf, emptyAccountsMessage } from '../company-labels';
import { CompaniesFilters } from '../components/companies-filters';
import { CompaniesSearchResults } from '../components/companies-search-results';
import { CompaniesTable } from '../components/companies-table';
import { CompanyTabs } from '../components/company-tabs';
import { PendingDeletionsNotice } from '../components/pending-deletions-notice';
import { PersonalAccountsList } from '../components/personal-accounts-list';
import { cursorResetHref, cursorResetNotice } from '../personal-accounts-labels';

/**
 * Los borrados pendientes no son la lista: si el backend no los puede dar (no responde, o niega), la
 * lista sigue sin el aviso. Todo lo demás sube: el redirect de un 401, que cierra la sesión, y un error
 * del código, que no tiene que desaparecer en silencio con el aviso (CA-27).
 */
function withoutPendingIfUnavailable(e: unknown): [] {
  const reason = (e as { data?: { reason?: unknown } } | null)?.data?.reason;
  if (reason === 'unavailable' || reason === 'forbidden') return [];
  throw e;
}

const SEARCH = z.object({ text: z.string().min(1).max(MAX_SEARCH_LENGTH), kind: z.enum(['company', 'personal']), plan: z.enum(['', ...LIST_PLANS]) });

/** Lo que responde una búsqueda que no llega al backend: sin texto, o con uno más largo que un correo. */
const NOTHING_FOUND: CompaniesSearch = { companies: [], hasMore: false, onlySome: true };

/**
 * La pestaña y el plan de la dirección. Un plan que no existe no filtra (CB-6), y en las cuentas
 * personales no hay plan: la lista por el índice no filtra por plan.
 */
function filtersFrom(params: URLSearchParams): { kind: AccountKind; plan: ListPlan | null } {
  const kind = params.get('kind') === 'personal' ? 'personal' : 'company';
  const plan = params.get('plan');
  return { kind, plan: kind === 'company' && isListPlan(plan) ? plan : null };
}

type LoaderArgs = { request: Request; context: Readonly<RouterContextProvider> };

/**
 * Una página de las cuentas personales por el índice (CA-23 y CA-24 de «Registro abierto»): una sola,
 * la del cursor de la dirección o la primera. Un cursor que no tiene su forma no llega al backend, y uno
 * que el backend no entiende (422) tampoco da la pantalla de error: los dos vuelven a la primera página
 * con un aviso.
 */
async function personalAccountsPage(args: LoaderArgs, params: URLSearchParams) {
  const after = params.get(AFTER_PARAM) || null;
  if (after !== null && !isCursor(after)) throw redirect(cursorResetHref());
  const page = await fromAdminApi(args, async (api, token) => {
    const result = await api.listPersonalAccounts(token, { after });
    // Con el tipo fijo, lo único que el backend puede no entender es el cursor. Sin cursor, un 422 sigue
    // siendo «ese enlace ya no sirve»: redirigir a la misma página daría vueltas sin fin.
    if (result.kind === 'invalid' && after !== null) throw redirect(cursorResetHref());
    return result;
  });
  return { tab: 'personal' as const, ...page, after };
}

/** Una página de las empresas: la lista de siempre, por nombre, con su plan y su número de página. */
async function companiesPage(args: LoaderArgs, params: URLSearchParams, plan: ListPlan | null) {
  const page = await fromAdminApi(args, (api, token) => api.listCompanies(token, { kind: 'company', plan, page: pageFrom(params) }));
  return { tab: 'company' as const, ...page };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const { kind, plan } = filtersFrom(url.searchParams);
  const member = context.get(teamMemberContext);
  const [list, pendingDeletions] = await Promise.all([
    kind === 'personal' ? personalAccountsPage({ request, context }, url.searchParams) : companiesPage({ request, context }, url.searchParams, plan),
    // Los borrados a medias, solo para el superadministrador (CA-27).
    member?.isSuperadmin === true
      ? fromAdminApi({ request, context }, (api, token) => api.listPendingDeletions(token)).catch(withoutPendingIfUnavailable)
      : Promise.resolve([]),
  ]);
  // El botón de crear solo para quien puede (CA-16): esconder no protege, la ruta también lo pide.
  return { ...list, pendingDeletions, canCreate: member ? can(member, 'companies', 'edit') : false };
}

/** Buscar no cambia la lista: no hace falta volver a pedirla después de cada búsqueda. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod === 'POST' ? false : defaultShouldRevalidate;
}

/** La búsqueda. Devuelve también qué buscó, para que la pantalla descarte respuestas viejas. */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const text = searchQuery(String(form.get('text') ?? ''));
  const [kind, plan] = [String(form.get('kind') ?? ''), String(form.get('plan') ?? '')];
  const scope = searchScope({ kind, plan });
  const parsed = SEARCH.safeParse({ text, kind, plan });
  if (!parsed.success) return { text, scope, result: NOTHING_FOUND };
  const { data } = parsed;
  const result = await fromAdminApi({ request, context }, (api, token) => api.searchCompanies(token, { text: data.text, kind: data.kind, plan: data.plan || null }));
  return { text, scope, result };
}

export default function Companies({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const filters = filtersFrom(params);
  const { kind, plan } = filters;
  const search = useBackgroundSearch<CompaniesSearch>({ kind, plan: plan ?? '' }, kind);
  const { counts, onlySome, canCreate, pendingDeletions } = loaderData;
  const { state } = search;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas' }]}
        title="Empresas"
        lead="Los clientes, con su plan, sus asientos y cuándo vence lo que pagaron. Las cuentas personales, de una persona sola, van en su propia pestaña."
        actions={canCreate
          ? <Link className="btn primary" to={kind === 'personal' ? '/companies/new?kind=personal' : '/companies/new'}><Icon name="plus" />{kind === 'personal' ? 'Nueva cuenta personal' : 'Nueva empresa'}</Link>
          : undefined}
      />
      <DoneNotice text={deletedNotice(params)} />
      <PendingDeletionsNotice pending={pendingDeletions} />
      <FilterNotice onlySome={onlySome} />
      <CompanyTabs kind={kind} counts={counts} />
      {loaderData.tab === 'personal'
        ? <PersonalAccountsList list={loaderData} search={search} notice={cursorResetNotice(params)} />
        : (
          <section className="card">
            <CompaniesFilters
              kind={kind} counts={loaderData.counts.companies} plan={plan} text={search.text}
              onTextChange={search.setText} onPlanChange={(p) => navigate(companiesHref({ kind, plan: p }))}
              onClearAll={() => { search.setText(''); navigate(companiesHref({ kind, plan: null })); }}
            />
            <div className="card-b">
              {state.kind !== 'idle'
                ? <CompaniesSearchResults state={state} query={searchQuery(search.text)} kind={kind} plan={plan} />
                : <CompaniesTable companies={loaderData.companies} emptyMessage={emptyAccountsMessage(kind, plan)} />}
            </div>
            {state.kind === 'idle' && (
              <Pager page={loaderData.page} of={countOf(kind, loaderData.page.total)} hrefOf={(n) => companiesHref(filters, n)} />
            )}
          </section>
        )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Empresas · Panel ensō' }];
}
