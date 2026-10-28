// Cómo se escriben fechas e iniciales en el panel. Puras: las usan varios módulos.
//
// ⚠️ Las fechas se arman a mano y no con `Intl`: el texto de `Intl` sale de la librería de idiomas
// de cada lado (la de Node y la de cada navegador), que puede cambiar un espacio, y React vería una
// diferencia al hidratar cada fecha. A mano, servidor y navegador escriben exactamente lo mismo.

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La hora de Bogotá: UTC-5 todo el año (Colombia no tiene horario de verano). */
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** La fecha en Bogotá, o `null` si no hay. Una fecha suelta (`2026-12-31`) se toma tal cual, sin correrse de día. */
function inBogota(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return dateOnly ? d : new Date(d.getTime() + BOGOTA_OFFSET_MS);
}

/** `1 nov 2026`, o `—` si no hay fecha. */
export function formatDate(iso: string | null | undefined): string {
  const d = inBogota(iso);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '—';
}

/** `1 nov 2026, 09:30` (hora de Bogotá, de 24 horas), o `—`. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = inBogota(iso);
  return d ? `${formatDate(iso)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '—';
}

/** Las iniciales de un nombre, como las del panel viejo: la primera letra de las dos primeras palabras. */
export const initialsOf = (name: string) =>
  name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '·';

/** Cuántos colores tiene la paleta de los logos (`company-badge.css`). */
const PALETTE_SIZE = 8;

/** El color estable de una empresa: el mismo hash que `colorDe` del panel viejo. */
export function colorIndexOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % PALETTE_SIZE;
}
