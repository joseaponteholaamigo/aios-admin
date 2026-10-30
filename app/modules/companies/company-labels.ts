// Cómo se nombran el plan, el estado y el vencimiento de una cuenta, con el tono de su insignia, y
// lo que dicen las listas y la búsqueda. Puras: las usan la lista y la ficha.
import type { AccountKind, Company, ContentBase, ListPlan, Quotas } from '../../domain/companies';
import type { Label } from '../../shared/ui/badge';

export { badgeClass } from '../../shared/ui/badge';

const PLANS: Record<string, Label> = {
  custom: { text: 'Personalizado', tone: 'violet' },
  team: { text: 'Team', tone: 'accent' },
  pro: { text: 'Pro', tone: 'accent' },
  free: { text: 'Free', tone: '' },
};

export const planLabel = (plan: Company['plan']): Label => (plan ? PLANS[plan] ?? { text: plan, tone: '' } : { text: 'Sin plan', tone: '' });

/**
 * El estado de la empresa. Si su suscripción terminó lo dice el backend (`expiredBy`), así que el
 * panel no repite la lista de estados de Stripe que terminan.
 */
export function statusLabel(company: Company): Label {
  if (company.status === 'active') return { text: 'Activa', tone: 'ok' };
  if (company.status === 'revoked') return { text: 'Revocada', tone: 'bad' };
  if (company.status === 'incomplete') return { text: 'Sin pagar', tone: 'warn' };
  if (company.expiry.expiredBy === 'subscription') return { text: 'Terminó', tone: 'warn' };
  return { text: company.status ?? '—', tone: '' };
}

/** De qué contenido parte la empresa, en palabras. */
export const CONTENT_LABELS: Record<ContentBase, string> = { everything: 'Todo su plan', free: 'Lo de Free', nothing: 'Nada' };

const QUOTA_LABELS: Record<string, string> = { radar: 'Radar', projects: 'Proyectos', skills: 'Skills', chains: 'Cadenas' };

/** Los cupos en una línea: `Radar: 5 · Proyectos: sin tope`. `null` es sin tope. */
export function quotasLabel(quotas: Quotas): string {
  const entries = Object.entries(quotas);
  if (entries.length === 0) return '—';
  return entries.map(([name, value]) => `${QUOTA_LABELS[name] ?? name}: ${value === null ? 'sin tope' : value}`).join(' · ');
}

/** El vencimiento en una insignia, o `null` si no hay nada que avisar. */
export function expiryLabel(company: Company): Label | null {
  if (company.expiry.expired) return { text: company.expiry.expiredBy === 'subscription' ? 'Venció la suscripción' : 'Venció', tone: 'bad' };
  if (company.notice) return { text: company.notice, tone: 'warn' };
  return null;
}

/** De dónde salió una cuenta personal: una compra en la web (paga por Stripe) o un alta del equipo. */
export const originLabel = (company: Company) => (company.paysWithStripe ? 'Compra en la web' : 'Alta del equipo');

/** Cómo se nombra cada tipo de cuenta, en singular y en plural. */
const KIND_NAMES: Record<AccountKind, { one: string; many: string; none: string }> = {
  company: { one: 'empresa', many: 'empresas', none: 'Ninguna empresa' },
  personal: { one: 'cuenta personal', many: 'cuentas personales', none: 'Ninguna cuenta personal' },
};

/** `3 empresas`, `1 cuenta personal`. */
export const countOf = (kind: AccountKind, n: number) => `${n} ${n === 1 ? KIND_NAMES[kind].one : KIND_NAMES[kind].many}`;

/**
 * Qué dice la lista cuando no trae ninguna cuenta: con un plan elegido, que nadie lo tiene; fuera de
 * la primera página, que la lista terminó.
 */
export function emptyAccountsMessage(kind: AccountKind, plan: ListPlan | null, laterPage: boolean): string {
  if (laterPage) return `En esta página no quedan ${KIND_NAMES[kind].many}.`;
  if (plan) return `${KIND_NAMES[kind].none} tiene el plan ${planLabel(plan).text}.`;
  return `Todavía no hay ${KIND_NAMES[kind].many} para mostrar.`;
}

/** La frase sobre lo que encontró una búsqueda: cuántas, con qué texto, dónde y si hay más. */
export function searchSummary(kind: AccountKind, query: string, plan: ListPlan | null, found: { count: number; hasMore: boolean }): string {
  const where = kind === 'personal' ? 'en el correo o el id' : 'en el nombre o el id';
  const inPlan = plan ? `, en el plan ${planLabel(plan).text}` : '';
  if (found.count === 0) return `${KIND_NAMES[kind].none} tiene «${query}» ${where}${inPlan}.`;
  const more = found.hasMore ? ` Se muestran las primeras ${found.count}: escribe más para acotar.` : '';
  return `${countOf(kind, found.count)} con «${query}» ${where}${inPlan}.${more}`;
}
