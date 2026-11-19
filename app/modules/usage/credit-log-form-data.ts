// Los filtros de la bitácora de créditos, leídos del formulario (spec «Créditos por persona» de
// aios-tower, CA-30). Puro: lo prueba `tests/credit-log.test.ts`. El backend vuelve a revisar todo.
import {
  CREDIT_LOG_KINDS, CREDIT_LOG_MAX_MONTHS, CREDIT_MODULES, type CreditLogFilters, type CreditLogKind, type CreditModule,
} from '../../domain/credits';

/** Sin filtros: el mes en curso, la primera página. */
export const NO_FILTERS: CreditLogFilters = { company: null, email: null, module: null, kind: null, from: null, to: null, page: 1 };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const COMPANY = /^[a-z0-9-]{1,80}$/;

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const isDay = (value: string) => DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const monthsBetween = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;

/** Los filtros escritos tal cual, para volver a llenar el formulario. */
export const filterValues = (form: FormData): Record<string, string> =>
  Object.fromEntries(['company', 'email', 'module', 'kind', 'from', 'to'].map((name) => [name, text(form, name)]));

/** Los filtros (`{ filters }`) o sus errores por campo (`{ errors }`). Lo vacío es «sin ese filtro». */
export function readCreditLogFilters(form: FormData): { filters: CreditLogFilters } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const [company, email, module, kind, from, to] = ['company', 'email', 'module', 'kind', 'from', 'to'].map((name) => text(form, name));
  if (company && !COMPANY.test(company)) errors.company = 'El id de la empresa va en minúsculas, con números y guiones: está en su ficha.';
  if (email && !EMAIL.test(email)) errors.email = 'Escribe un correo válido.';
  if (module && !(CREDIT_MODULES as readonly string[]).includes(module)) errors.module = 'Elige un módulo de la lista.';
  if (kind && !(CREDIT_LOG_KINDS as readonly string[]).includes(kind)) errors.kind = 'Elige un tipo de la lista.';
  if (from && !isDay(from)) errors.from = 'Elige una fecha.';
  if (to && !isDay(to)) errors.to = 'Elige una fecha.';
  if (from && to && isDay(from) && isDay(to)) {
    if (from > to) errors.to = '«Hasta» no puede ser antes de «desde».';
    else if (monthsBetween(from, to) > CREDIT_LOG_MAX_MONTHS) errors.to = `La consulta abarca hasta ${CREDIT_LOG_MAX_MONTHS} meses.`;
  }
  if (Object.keys(errors).length) return { errors };
  const page = Number(text(form, 'page'));
  return {
    filters: {
      company: company || null, email: email ? email.toLowerCase() : null,
      module: (module || null) as CreditModule | null, kind: (kind || null) as CreditLogKind | null,
      from: from || null, to: to || null, page: Number.isInteger(page) && page > 0 ? page : 1,
    },
  };
}
