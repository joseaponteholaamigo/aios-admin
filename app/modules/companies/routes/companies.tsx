// Empresas: las cuentas de los clientes en dos pestañas, las empresas y las cuentas personales (spec
// «Cuentas personales», CA-18 a CA-21), con búsqueda, filtro de plan y páginas (CA-23 y CA-26 de
// M2a). Los filtros se aplican solos, como en Usuarios de clientes, y la búsqueda ocupa el lugar de
// la lista mientras tiene texto.
//
// La pestaña, el plan y el número de página viajan en la dirección: cada página se puede compartir y
// recargar (spec «Paginación numerada», CA-8).
// El texto va al servidor por POST, y en la barra del navegador solo después del `#`
// (`use-background-search.ts`): en las cuentas personales se busca por correo.
import { useNavigate, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/companies';
import { LIST_PLANS, isListPlan, type AccountKind, type CompaniesSearch, type ListPlan } from '../../../domain/companies';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { pageFrom } from '../../../shared/routing/page-param';
import { MAX_SEARCH_LENGTH, searchQuery, searchScope, useBackgroundSearch } from '../../../shared/search/use-background-search';
import { Pager } from '../../../shared/ui/pager';
import { companiesHref } from '../companies-href';
import { countOf, emptyAccountsMessage } from '../company-labels';
import { CompaniesFilters } from '../components/companies-filters';
import { CompaniesSearchResults } from '../components/companies-search-results';
import { CompaniesTable } from '../components/companies-table';
import { CompanyTabs } from '../components/company-tabs';
import { PersonalAccountsTable } from '../components/personal-accounts-table';

const SEARCH = z.object({ text: z.string().min(1).max(MAX_SEARCH_LENGTH), kind: z.enum(['company', 'personal']), plan: z.enum(['', ...LIST_PLANS]) });

/** Lo que responde una búsqueda que no llega al backend: sin texto, o con uno más largo que un correo. */
const NOTHING_FOUND: CompaniesSearch = { companies: [], hasMore: false, onlySome: true };

/** La pestaña y el plan de la dirección. Un plan que no existe no filtra (CB-6). */
function filtersFrom(params: URLSearchParams): { kind: AccountKind; plan: ListPlan | null } {
  const plan = params.get('plan');
  return { kind: params.get('kind') === 'personal' ? 'personal' : 'company', plan: isListPlan(plan) ? plan : null };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const { kind, plan } = filtersFrom(url.searchParams);
  const page = pageFrom(url.searchParams);
  return fromAdminApi({ request, context }, (api, token) => api.listCompanies(token, { kind, plan, page }));
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
  const { companies, page, counts, onlySome } = loaderData;
  const emptyMessage = emptyAccountsMessage(kind, plan);
  const { state } = search;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Empresas' }]}
        title="Empresas"
        lead="Los clientes, con su plan, sus asientos y cuándo vence lo que pagaron. Las cuentas personales, de una persona sola, van en su propia pestaña."
      />
      <FilterNotice onlySome={onlySome} />
      <CompanyTabs kind={kind} counts={counts} />
      <section className="card">
        <CompaniesFilters
          kind={kind} counts={kind === 'personal' ? counts.personal : counts.companies} plan={plan} text={search.text}
          onTextChange={search.setText} onPlanChange={(p) => navigate(companiesHref({ kind, plan: p }))}
          onClearAll={() => { search.setText(''); navigate(companiesHref({ kind, plan: null })); }}
        />
        <div className="card-b">
          {state.kind !== 'idle'
            ? <CompaniesSearchResults state={state} query={searchQuery(search.text)} kind={kind} plan={plan} />
            : kind === 'personal'
              ? <PersonalAccountsTable accounts={companies} emptyMessage={emptyMessage} />
              : <CompaniesTable companies={companies} emptyMessage={emptyMessage} />}
        </div>
        {state.kind === 'idle' && (
          <Pager page={page} of={countOf(kind, page.total)} hrefOf={(n) => companiesHref(filters, n)} />
        )}
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
