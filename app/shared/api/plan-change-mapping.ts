// La traducción del cambio de plan entre el panel y el backend (`PATCH /v1/admin/clientes/{id}/condiciones`,
// spec «Editar cuentas y personas», contrato «Plan y características»): el pedido a sus nombres en español,
// y la vista previa o lo guardado de vuelta a los del panel.
import { PLAN_CONFIRMATIONS, type PlanChange, type PlanChangeResult, type PlanConfirmation, type PlanSnapshot } from '../../domain/plan-change';
import { asRecord, num, strOrNull, type Log } from './api-reading';
import { toConditions, toContent } from './companies-mapping';
import { conditionsWithoutQuotasToApi, quotasToApi } from './write-mapping';

export const planChangePath = (companyId: string) => `/v1/admin/clientes/${encodeURIComponent(companyId)}/condiciones`;

/**
 * El cuerpo del pedido. Un Personalizado manda siempre sus cupos, también vacíos: un campo que no viaja se conserva del
 * Personalizado actual, y sin `cupos` no habría forma de quitarle uno. Guardar va siempre con `confirmo`: se oprime
 * después de ver lo que hay que confirmar.
 */
export function toBackendPlanChange({ target, reason, previewOnly }: PlanChange) {
  return {
    plan: target.plan === 'free' ? 'free' : 'personalizado',
    ...(target.plan === 'custom' ? { condiciones: { ...conditionsWithoutQuotasToApi(target.conditions), cupos: quotasToApi(target.conditions.quotas) } } : {}),
    ...(reason ? { motivo: reason } : {}),
    ...(previewOnly ? { soloVer: true } : { confirmo: true }),
  };
}

const CONFIRMATION_FROM_API: Record<string, Exclude<PlanConfirmation, 'unknown'>> = {
  'pierde-condiciones': 'loses-conditions', 'pausa-personas': 'pauses-people', vacio: 'empty',
};

function toConfirmation(raw: unknown, log: Log): PlanConfirmation {
  const known = CONFIRMATION_FROM_API[String(raw)];
  if (!known) log(`el cambio de plan pide confirmar algo que el panel no conoce: ${String(raw)}`);
  return known && PLAN_CONFIRMATIONS.includes(known) ? known : 'unknown';
}

/** El plan de antes o de después: `personalizado` es el Personalizado del panel; otro valor, el tier tal cual. */
function toSnapshot(raw: unknown, what: string, log: Log): PlanSnapshot {
  const s = asRecord(raw, what);
  const plan = strOrNull(s.plan);
  return { plan: plan === 'personalizado' ? 'custom' : plan, content: toContent(s.contenido), conditions: toConditions(s.condiciones, log) };
}

const texts = (raw: unknown) => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);

/** Lo que responde un cambio de plan: la vista previa, o lo que quedó guardado. */
export function toPlanChangeResult(body: unknown, log: Log): PlanChangeResult {
  const b = asRecord(body, 'el cambio de plan');
  return {
    previewOnly: b.soloVer === true,
    changed: b.cambio === true,
    before: toSnapshot(b.antes, 'el cambio de plan: antes', log),
    after: toSnapshot(b.despues, 'el cambio de plan: después', log),
    notices: texts(b.avisos),
    toConfirm: (Array.isArray(b.confirmar) ? b.confirmar : []).map((c) => toConfirmation(c, log)),
    pausedPeople: num(b.personasEnPausa),
  };
}
