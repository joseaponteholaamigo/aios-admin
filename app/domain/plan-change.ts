// Cambiar el plan y las características de una cuenta desde el panel (spec «Editar cuentas y personas»,
// CA-27 y CA-28): pasarla a Free, a un Personalizado (o al «Pro» del panel, que es un Personalizado con
// `PRO_CONDITIONS`), o cambiar el Personalizado que ya tiene. Primero se ve el cambio; después se guarda.
// Los nombres del backend se traducen en `app/shared/api/plan-change-mapping.ts`.
import type { PlanConditions } from './account-creation';
import type { CompanyPlan, ContentBase, CustomConditions } from './companies';

/** El plan de destino: Free, o un Personalizado con sus condiciones. */
export type PlanTarget = { plan: 'free' } | { plan: 'custom'; conditions: PlanConditions };

/** Lo que pide el panel. `previewOnly`: solo ver cómo quedaría; sin él, guardar con la confirmación de lo que se pierde. */
export type PlanChange = { target: PlanTarget; reason: string; previewOnly: boolean };

/** Lo que el cambio le quita a la cuenta y hay que confirmar. `unknown`: algo que el backend agregó y el panel no nombra. */
export const PLAN_CONFIRMATIONS = ['loses-conditions', 'pauses-people', 'empty'] as const;
export type PlanConfirmation = (typeof PLAN_CONFIRMATIONS)[number] | 'unknown';

/** El plan de una cuenta antes o después del cambio: el plan, el contenido de base de un Personalizado y sus condiciones. */
export type PlanSnapshot = { plan: CompanyPlan | null; content: ContentBase | null; conditions: CustomConditions | null };

export type PlanChangeResult = {
  previewOnly: boolean;
  /** `false`: lo pedido ya era lo que había, y no se escribió nada. */
  changed: boolean;
  before: PlanSnapshot;
  after: PlanSnapshot;
  /** Lo que conviene saber, redactado por el backend. */
  notices: string[];
  toConfirm: PlanConfirmation[];
  /** Cuántas personas quedan en pausa al pasar a Free. */
  pausedPeople: number;
};

/** Por qué «Cambiar plan» no se ofrece (CA-27): una suscripción de Stripe que cobra, o la cuenta revocada. */
export type PlanChangeBlock = 'charging' | 'revoked';

type PlanState = { status: string | null; plan: CompanyPlan | null; stripeCanCharge: boolean };

/**
 * Lo que frena el cambio, o `null`. Con una suscripción que cobra, solo un Personalizado puede seguir cambiando sus
 * condiciones: su precio propio lo acordó el equipo (decisión 4).
 */
export function planChangeBlock({ status, plan, stripeCanCharge }: PlanState): PlanChangeBlock | null {
  if (status === 'revoked') return 'revoked';
  if (stripeCanCharge && plan !== 'custom') return 'charging';
  return null;
}

/** Un Personalizado con cobro de Stripe cambia sus condiciones, pero no deja de ser Personalizado (decisión 4). */
export const lockedToCustom = ({ plan, stripeCanCharge }: PlanState) => stripeCanCharge && plan === 'custom';
