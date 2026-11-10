// Consumo: la bitácora de créditos de todas las empresas (spec «Créditos por persona» de aios-tower,
// CA-27 a CA-32, CB-14 y CB-15). Pide «ver» en Consumo (`route-table.ts`); el backend lo vuelve a pedir.
//
// Sin filtros se ve el mes en curso. Los filtros y la página van por POST, en el cuerpo: el de persona
// es un correo, y un correo no va en la dirección ni en los registros de acceso.
import { Form } from 'react-router';
import type { Route } from './+types/usage';
import type { CreditLogPage } from '../../../domain/credits';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { Pager } from '../../../shared/ui/pager';
import { CreditLogFilters } from '../components/credit-log-filters';
import { CreditLogTable } from '../components/credit-log-table';
import { NO_FILTERS, filterValues, readCreditLogFilters } from '../credit-log-form-data';

type Answer = { values: Record<string, string>; errors: Record<string, string>; log: CreditLogPage | null };

export async function loader({ request, context }: Route.LoaderArgs): Promise<Answer> {
  const log = await fromAdminApi({ request, context }, (api, token) => api.listCreditLog(token, NO_FILTERS));
  return { values: {}, errors: {}, log };
}

export async function action({ request, context }: Route.ActionArgs): Promise<Answer> {
  const form = await request.formData();
  const values = filterValues(form);
  const read = readCreditLogFilters(form);
  if ('errors' in read) return { values, errors: read.errors, log: null };
  const log = await fromAdminApi({ request, context }, (api, token) => api.listCreditLog(token, read.filters));
  return { values, errors: {}, log };
}

export default function Usage({ loaderData, actionData }: Route.ComponentProps) {
  const { values, errors, log } = actionData ?? loaderData;
  const filtered = Object.values(values).some(Boolean);
  // Un filtro inválido deja la última lista buena a la vista, con el error junto a su campo.
  const shown = log ?? loaderData.log;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Consumo' }]}
        title="Bitácora de créditos"
        lead="Cada operación con créditos de cada empresa y cada persona: lo que se gastó, se cargó, se compró y se venció. Nunca su contenido."
      />
      <Form method="post" className="grid">
        <CreditLogFilters values={values} errors={errors} filtered={filtered} />
        <section className="card">
          {shown && shown.rows.length > 0
            ? <CreditLogTable rows={shown.rows} />
            : <div className="card-b"><p className="empty">{filtered ? 'No hay movimientos con estos filtros. Quítalos para ver el mes en curso.' : 'Este mes todavía no hay movimientos de créditos.'}</p></div>}
          {shown && <Pager page={shown.page} of={`${shown.page.total} movimientos`} submitName="page" />}
        </section>
      </Form>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Bitácora de créditos · Panel ensō' }];
}
