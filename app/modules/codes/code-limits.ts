// Los topes de cada campo de un código de registro: los mismos del backend (`src/lib/codigos-reglas.js`).
// Un solo lugar para el formulario, la validación y el detalle: si el backend cambia uno, cambia aquí.
export const LABEL_MAX = 80;
export const REASON_MAX = 500;
export const CODE_MIN = 8;
export const CODE_MAX = 40;
export const MONTHS_MAX = 36;
export const DAYS_MAX = 1095;
export const MONTHLY_CREDITS_MAX = 1000;
export const USES_MAX = 1_000_000;
export const DEFAULT_MONTHLY_CREDITS = 1000;
export const DEFAULT_DAILY_BRAKE = 200;

/** El tope de días o de meses del plan, según cómo se cuente. */
export const durationMax = (kind: 'months' | 'days') => (kind === 'months' ? MONTHS_MAX : DAYS_MAX);
