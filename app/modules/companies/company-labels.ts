// Cómo se nombran el plan, el estado y el vencimiento de una empresa, con el tono de su insignia.
// Puras: las usan la lista y la ficha.
import type { Company, ContentBase, Quotas } from '../../domain/companies';
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
