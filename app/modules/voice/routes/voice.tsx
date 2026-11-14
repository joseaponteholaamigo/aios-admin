// El tope de la voz de ENSŌ (spec «Registro abierto» de aios-tower, CA-33; tarea RP2): el valor general,
// que rige para toda cuenta, y las excepciones por cuenta. Solo el superadministrador (`route-table.ts`);
// el backend lo vuelve a pedir y, para cambiarlo, pide además MFA reciente. Cada cambio lleva un motivo
// y queda en la auditoría con el antes y el después. Al guardar vuelve aquí con el aviso; un rechazo se
// queda en el formulario que lo mandó, con lo escrito.
import { redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/voice';
import { toAdminApi } from '../../../shared/api/admin-action.server';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { DoneNotice } from '../../../shared/ui/done-notice';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { CapExceptionsCard } from '../components/cap-exceptions-card';
import { GeneralCapCard } from '../components/general-cap-card';
import { readVoiceCapChange, valuesOf, type VoiceAttempt } from '../voice-form-data';
import { voiceCapNotice, voiceCapNoticeParams } from '../voice-labels';

export async function loader({ request, context }: Route.LoaderArgs) {
  return { caps: await fromAdminApi({ request, context }, (api, token) => api.getVoiceCaps(token)) };
}

export async function action({ request, context }: Route.ActionArgs): Promise<VoiceAttempt | Response> {
  const form = await request.formData();
  const values = valuesOf(form);
  const read = readVoiceCapChange(form);
  if (read.intent === null) return { intent: null, values, errors: {}, rejection: { code: 'invalid', message: 'ese pedido no se entiende: recarga la página' } };
  if ('errors' in read) return { intent: read.intent, values, errors: read.errors, rejection: null };
  const outcome = await toAdminApi({ request, context }, (api, token) => api.changeVoiceCap(token, read.change));
  if (!outcome.ok) return { intent: read.intent, values, errors: {}, rejection: outcome.rejection };
  return redirect(`/voice?${voiceCapNoticeParams(read.change, outcome.value)}`);
}

export default function Voice({ loaderData, actionData }: Route.ComponentProps) {
  const { caps } = loaderData;
  const [params] = useSearchParams();
  const attempt = actionData ?? null;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Negocio' }, { label: 'Tope de la voz' }]}
        title="Tope de la voz"
        lead="Cuánto puede gastar cada persona al mes en la voz de ENSŌ, en dólares. Rige el general; una cuenta con excepción usa el suyo."
      />
      <DoneNotice text={voiceCapNotice(params)} />
      {attempt?.intent === null && attempt.rejection && <FormRejection rejection={attempt.rejection} />}
      <div className="grid">
        <GeneralCapCard general={caps.general} maxUsd={caps.maxUsd} attempt={attempt?.intent === 'general' ? attempt : null} />
        <CapExceptionsCard exceptions={caps.exceptions} generalUsd={caps.general.usd} maxUsd={caps.maxUsd} onlySome={caps.onlySome} attempt={attempt} />
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Tope de la voz · Panel ensō' }];
}
