// Cómo se leen los créditos en el panel: el saldo de una persona (Usuarios de clientes) y la bitácora
// (Consumo). Compartido porque lo usan los dos módulos.
import type { CreditAccess, CreditLogKind, CreditLogRow, CreditModule, CreditSource, CreditStatus } from '../../domain/credits';
import type { Label } from '../ui/badge';

/** Un número de créditos como se lee en Colombia: 11.000. */
export const formatCredits = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('es-CO') : '—');

/** Qué hizo cada operación, por su concepto. Un concepto nuevo del backend se muestra tal cual. */
const CONCEPTS: Record<string, string> = {
  estudio: 'Estudio · pedido',
  'contactos.buscar': 'Contactos · buscar',
  'contactos.enriquecer': 'Contactos · datos de contacto',
  'video.ia': 'Video con IA',
  'video.apoyo': 'Video · material de apoyo',
};
export const conceptLabel = (concept: string | null) => (concept ? CONCEPTS[concept] ?? concept : '—');

export const MODULE_LABELS: Record<CreditModule, string> = { contacts: 'Contactos', video: 'Video', studios: 'Estudios' };

export const KIND_LABELS: Record<CreditLogKind, string> = { spend: 'Gasto', load: 'Carga', purchase: 'Compra', expiry: 'Vencimiento' };

const STATUS: Record<CreditStatus, Label> = {
  'in-progress': { text: 'en curso', tone: 'warn' },
  charged: { text: 'cobrado', tone: 'ok' },
  returned: { text: 'devuelto', tone: '' },
  expired: { text: 'vencida', tone: '' },
};
export const statusLabel = (status: CreditStatus | null): Label | null => (status ? STATUS[status] : null);

const ACCESS: Record<CreditAccess, Label> = {
  'with-plan': { text: 'Puede gastar', tone: 'ok' },
  'no-plan': { text: 'Free: sin créditos', tone: '' },
  'no-access': { text: 'Sin acceso vigente: no gasta', tone: 'bad' },
};
export const accessLabel = (access: CreditAccess): Label => ACCESS[access];

/** De dónde salió un gasto: «bolsa de 2026-11 · 200» o «Small · 1.300». */
export const sourceLabel = (s: CreditSource) => (s.kind === 'month' ? `bolsa de ${s.month} · ${formatCredits(s.credits)}` : `${s.name ?? 'lote'} · ${formatCredits(s.credits)}`);

/** Cuánto y de qué tipo pidió y obtuvo una operación, sin su contenido: «30 personas», «Veo 3.1 Lite · 8 s». */
export function amountLabel(row: Pick<CreditLogRow, 'concept' | 'detail' | 'result'>): string {
  const { detail: d, result: r } = row;
  const n = (v: unknown) => (typeof v === 'number' ? formatCredits(v) : null);
  switch (row.concept) {
    case 'contactos.buscar':
      return n(r.personas) !== null ? `${n(r.personas)} personas` : n(d.cantidad) !== null ? `hasta ${n(d.cantidad)} personas` : '—';
    case 'contactos.enriquecer':
      return n(r.encontrados) !== null ? `${n(r.encontrados)} datos encontrados` : n(d.contactos) !== null ? `${n(d.contactos)} contactos` : '—';
    case 'video.ia':
    case 'video.apoyo':
      return [d.modelo, typeof d.segundos === 'number' ? `${d.segundos} s` : null].filter(Boolean).join(' · ') || '—';
    case 'estudio':
      return typeof d.tipo === 'string' ? d.tipo : '—';
    default:
      return '—';
  }
}
