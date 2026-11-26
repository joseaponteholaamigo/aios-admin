// Lo que dice «Cambiar plan» (spec «Editar cuentas y personas», CA-27 y CA-28): por qué no se ofrece, el
// antes y el después en filas, lo que hay que confirmar y el aviso al guardar. Puras: las prueba
// `tests/change-plan.test.ts`.
import type { AccountKind, ContentBase, CustomConditions } from '../../domain/companies';
import { LIST_PLANS } from '../../domain/companies';
import type { PlanChangeBlock, PlanChangeResult, PlanConfirmation, PlanSnapshot } from '../../domain/plan-change';
import { formatDate } from '../../shared/ui/format';
import { CONTENT_LABELS, planLabel, quotasLabel } from './company-labels';

/** Por qué «Cambiar plan» está desactivado, a la vista junto al botón (CA-27). */
export const PLAN_CHANGE_BLOCK_REASONS: Record<PlanChangeBlock, string> = {
  charging: 'Tiene una suscripción de Stripe que cobra o puede volver a cobrar: primero hay que cancelarla en Stripe.',
  revoked: 'La cuenta está revocada: no cambia de plan hasta que se reactive.',
};

/** Lo que hay que confirmar, dicho para quien va a oprimir «Guardar». */
export function confirmationLabel(confirmation: PlanConfirmation, pausedPeople: number): string {
  switch (confirmation) {
    case 'loses-conditions': return 'Pierde las condiciones del Personalizado y sus reglas de empresa. Los roles y los ajustes de cada persona se conservan.';
    case 'pauses-people': return `En Free entra una sola persona: ${pausedPeople === 1 ? 'otra queda' : `otras ${pausedPeople} quedan`} en pausa.`;
    case 'empty': return 'Queda sin contenido: «Nada» de base y ninguna regla que le dé algo.';
    case 'unknown': return 'Hay algo más que confirmar que el panel no sabe nombrar: revisa los avisos.';
  }
}

const yesNo = (value: boolean | null | undefined) => (value === true ? 'Sí' : value === false ? 'No' : '—');
const contentText = (content: ContentBase | null) => (content ? CONTENT_LABELS[content] : '—');

type Row = { label: string; before: string; after: string };
type Field = { label: string; text: (s: PlanSnapshot) => string; companyOnly?: boolean };

/** Una condición de un Personalizado, o `—` si el plan no es Personalizado. */
const condition = (pick: (c: CustomConditions) => string) => (s: PlanSnapshot) => (s.conditions ? pick(s.conditions) : '—');

const FIELDS: Field[] = [
  { label: 'Plan', text: (s) => planLabel(s.plan).text },
  { label: 'Contenido de base', text: (s) => contentText(s.content) },
  { label: 'Asientos', text: condition((c) => (c.seats === null ? '—' : String(c.seats))), companyOnly: true },
  { label: 'Equipo compartido', text: condition((c) => yesNo(c.team)), companyOnly: true },
  { label: 'Horarios', text: condition((c) => yesNo(c.scheduling)) },
  { label: 'Fecha de fin', text: condition((c) => (c.until ? formatDate(c.until) : 'Sin fecha de fin')) },
  { label: 'Cupos', text: condition((c) => quotasLabel(c.quotas)) },
];

/** El antes y el después, fila por fila. Una cuenta personal no muestra asientos ni equipo: es de una persona. */
export function snapshotRows(result: Pick<PlanChangeResult, 'before' | 'after'>, kind: AccountKind): Row[] {
  return FIELDS.filter((f) => kind === 'company' || !f.companyOnly).map((f) => ({ label: f.label, before: f.text(result.before), after: f.text(result.after) }));
}

/** Un texto del backend como frase: con mayúscula al principio y punto al final. */
export const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.:]$/.test(text) ? '' : '.'}`;

// El aviso al volver a la ficha: el plan de antes y el de después, que no son datos de una persona.
const SAVED = 'plan';
const isListedPlan = (value: string | null): value is (typeof LIST_PLANS)[number] => LIST_PLANS.includes(value as (typeof LIST_PLANS)[number]);

export function planSavedNoticeParams({ changed, before, after }: Pick<PlanChangeResult, 'changed' | 'before' | 'after'>) {
  return new URLSearchParams({ aviso: SAVED, antes: before.plan ?? '', despues: after.plan ?? '', ...(changed ? {} : { igual: '1' }) });
}

/** Qué dice la ficha al volver de guardar el plan, o `null` si no viene de ahí. Solo con planes que el panel conoce. */
export function planSavedNotice(params: URLSearchParams): string | null {
  if (params.get('aviso') !== SAVED) return null;
  const [before, after] = [params.get('antes'), params.get('despues')];
  if (!isListedPlan(after) || (before !== '' && !isListedPlan(before))) return null;
  if (params.get('igual') === '1') return 'Lo pedido ya era lo que tenía: no cambió nada.';
  if (before === after && after === 'custom') return 'Se guardaron las condiciones del Personalizado. ENSŌ las toma la próxima vez que lo abran.';
  return `Plan cambiado${before ? ` de ${planLabel(before).text}` : ''} a ${planLabel(after).text}. ENSŌ lo toma la próxima vez que lo abran.`;
}
