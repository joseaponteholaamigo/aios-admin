// La clave de la casa de un servicio (spec «Compartir referentes» de aios-tower, D16, D17, D20, D21 y D30;
// CA-29 a CA-31 y CA-39 a CA-41): el estado y el último cambio, el saldo, el interruptor, poner, cambiar o
// quitar la clave, y el historial. Solo el superadministrador (`route-table.ts`); el backend lo vuelve a
// pedir. Cada cambio lleva un motivo, que queda en la auditoría sin la clave. Al guardar vuelve aquí con el
// aviso; un rechazo se queda en el formulario que lo mandó, con lo escrito, menos la clave.
//
// Un servicio que el panel no administra responde 404 sin preguntarle al backend (D18).
import { redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/house-key';
import { isHouseKeyService, type HouseKeyService } from '../../../domain/house-keys';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fail, fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { KeyFormCard } from '../components/key-form-card';
import { KeyHistoryCard } from '../components/key-history-card';
import { KeyStatusCard } from '../components/key-status-card';
import { readHouseKeyChange, safeValuesOf, type HouseKeyAttempt } from '../house-key-form-data';
import { SERVICE_INFO, houseKeyHref, houseKeyNotice, houseKeyNoticeParams } from '../house-keys-labels';

function serviceOf(raw: string | undefined): HouseKeyService {
  if (!isHouseKeyService(raw)) throw fail('not-found', 404);
  return raw;
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const service = serviceOf(params.service);
  return { detail: await fromAdminApi({ request, context }, (api, token) => api.getHouseKey(token, service)) };
}

export async function action({ request, context, params }: Route.ActionArgs): Promise<HouseKeyAttempt | Response> {
  const service = serviceOf(params.service);
  const form = await request.formData();
  // Lo que vuelve a la página: el motivo y la casilla. La clave, nunca (CA-31).
  const values = safeValuesOf(form);
  const read = readHouseKeyChange(form);
  if (read.intent === null) return { intent: null, values, errors: {}, rejection: { code: 'invalid', message: 'ese pedido no se entiende: recarga la página' } };
  if ('errors' in read) return { intent: read.intent, values, errors: read.errors, rejection: null };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeHouseKey(token, service, read.change));
  if (!outcome.ok) return { intent: read.intent, values, errors: {}, rejection: outcome.rejection };
  return redirect(`${houseKeyHref(service)}?${houseKeyNoticeParams(read.change)}`);
}

export default function HouseKey({ loaderData, actionData }: Route.ComponentProps) {
  const { detail } = loaderData;
  const [params] = useSearchParams();
  const attempt = actionData ?? null;
  const { name, lead } = SERVICE_INFO[detail.service];
  return (
    <>
      <PageHeader crumbs={[{ label: 'Negocio' }, { label: 'Claves de la casa', to: '/house-keys' }, { label: name }]} title={name} lead={lead} />
      <DoneNotice text={houseKeyNotice(params, detail)} />
      {attempt?.intent === null && attempt.rejection && <FormRejection rejection={attempt.rejection} />}
      <div className="grid g2">
        <KeyStatusCard status={detail} attempt={attempt?.intent === 'switch' ? attempt : null} />
        <KeyFormCard
          status={detail} keyAttempt={attempt?.intent === 'key' ? attempt : null} removeAttempt={attempt?.intent === 'remove' ? attempt : null}
        />
      </div>
      <KeyHistoryCard service={detail.service} history={detail.history} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const name = loaderData ? SERVICE_INFO[loaderData.detail.service].name : 'Clave de la casa';
  return [{ title: `${name} · Claves de la casa · Panel ensō` }];
}
