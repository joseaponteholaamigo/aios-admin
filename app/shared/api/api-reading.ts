// Lectores para traducir las respuestas del backend con desconfianza: lo que no tiene la forma
// esperada lanza `ApiContractError` (el contrato se rompió) en vez de llegar torcido a una pantalla.
// Un campo que el panel no conoce no rompe nada: se ignora y queda en el log (CA-24 de M2a).

/** La respuesta del backend no tiene la forma acordada. La página muestra un error, no datos torcidos. */
export class ApiContractError extends Error {}

export type Log = (message: string) => void;

export function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiContractError(`${what}: no es un objeto`);
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new ApiContractError(`${what}: no es una lista`);
  return value;
}

export function str(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new ApiContractError(`${what}: no es texto`);
  return value;
}

export const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export const numOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Avisa (sin romper) si `record` trae campos que el panel no conoce: el backend cambió y el panel no. */
export function warnUnknownFields(record: Record<string, unknown>, known: readonly string[], what: string, log: Log) {
  const unknown = Object.keys(record).filter((key) => !known.includes(key));
  if (unknown.length) log(`${what} trae campos que el panel no conoce y se ignoran: ${unknown.join(', ')}`);
}
