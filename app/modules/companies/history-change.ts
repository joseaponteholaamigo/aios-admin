// El antes y el después de un evento de la historia de una cuenta, en líneas que se leen (spec «Editar
// cuentas y personas», CA-4): `asientos: 5 → 8`. El backend los manda tal cual los guardó la auditoría, con
// sus nombres; aquí no se traducen, porque la historia muestra también `que` con el nombre técnico. Pura.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Un valor en una línea: `—` si no hay, sí o no, el texto o el número tal cual, y lo demás en JSON. */
function valueText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Las líneas del cambio. Si uno de los dos es un objeto, una línea por cada campo que cambió (un lado que
 * falta cuenta como vacío). Si no, una sola línea con los dos valores. Sin antes ni después, ninguna.
 */
export function changeLines(before: unknown, after: unknown): string[] {
  if ((before === null || before === undefined) && (after === null || after === undefined)) return [];
  if (!isRecord(before) && !isRecord(after)) return same(before, after) ? [] : [`${valueText(before)} → ${valueText(after)}`];
  const [b, a] = [isRecord(before) ? before : {}, isRecord(after) ? after : {}];
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return fields.filter((field) => !same(b[field], a[field])).map((field) => `${field}: ${valueText(b[field])} → ${valueText(a[field])}`);
}
