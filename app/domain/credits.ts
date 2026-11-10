// Los créditos de una persona y la bitácora de créditos (spec «Créditos por persona con un solo plan,
// Pro», `specs/2026-11-10-creditos-por-persona.md` de aios-tower): lo que el panel ve y lo que pide.
// Los nombres del backend se traducen en `app/shared/api/credits-mapping.ts`: aquí no aparece ninguno.
import type { PageInfo } from './pagination';

/** Qué puede hacer la persona con sus créditos hoy: gastarlos, nada por ser Free, o nada por no tener acceso. */
export type CreditAccess = 'with-plan' | 'no-plan' | 'no-access';

/** Un lote: un paquete comprado por Stripe o una carga del equipo de ENSŌ. Vence a un mes. */
export type CreditLot = {
  id: string;
  origin: 'purchase' | 'load';
  name: string | null;
  credits: number;
  balance: number;
  creditedAt: string;
  expiresAt: string;
};

/** Las filas de la bitácora: un gasto, una carga, una compra o un paquete que venció sin usarse. */
export const CREDIT_LOG_KINDS = ['spend', 'load', 'purchase', 'expiry'] as const;
export type CreditLogKind = (typeof CREDIT_LOG_KINDS)[number];

/** Los módulos de ENSŌ que gastan créditos. */
export const CREDIT_MODULES = ['contacts', 'video', 'studios'] as const;
export type CreditModule = (typeof CREDIT_MODULES)[number];

/** Cómo va un gasto: una sola fila que pasa de «en curso» a cobrado, devuelto o vencido. */
export type CreditStatus = 'in-progress' | 'charged' | 'returned' | 'expired';

/** Un movimiento en el saldo de una persona. */
export type CreditMovement = {
  id: string;
  kind: CreditLogKind;
  date: string;
  concept: string | null;
  status: CreditStatus | null;
  reserved: number | null;
  charged: number | null;
  /** Los créditos de un lote o de un vencimiento. */
  credits: number | null;
  name: string | null;
};

/** El saldo de una persona: la bolsa del mes, sus lotes vigentes y sus últimos movimientos. */
export type PersonCredits = {
  email: string;
  access: CreditAccess;
  /** Lo que puede gastar ahora. Sin acceso pagado es cero, aunque tenga lotes. */
  available: number;
  reserved: number;
  month: { credits: number; balance: number; renewsAt: string };
  lots: CreditLot[];
  movements: CreditMovement[];
};

/** El tope de una carga, igual que el del backend: una red contra un cero de más. */
export const LOAD_MAX = 100000;

/** Cargar créditos a una persona. `key` es la del formulario: enviarlo dos veces carga una vez. */
export type CreditLoad = { email: string; credits: number; reason: string; key: string };

/** El lote que dejó una carga. */
export type LoadedLot = { credits: number; expiresAt: string };

/** De dónde salió lo que gastó una operación: la bolsa de un mes o un lote. */
export type CreditSource =
  | { kind: 'month'; month: string; credits: number }
  | { kind: 'lot'; lotId: string; name: string | null; credits: number };

/** Una fila de la bitácora. Lo que no aplica a su tipo viene en `null`. Nunca trae el contenido del trabajo. */
export type CreditLogRow = {
  id: string;
  kind: CreditLogKind;
  date: string;
  company: { id: string; name: string | null };
  email: string;
  module: CreditModule | null;
  concept: string | null;
  status: CreditStatus | null;
  reserved: number | null;
  charged: number | null;
  returned: number | null;
  /** Lo que volvió a una bolsa o un lote que ya había vencido: se perdió. */
  discarded: number | null;
  /** Cuánto y de qué tipo pidió la operación, y qué obtuvo: personas, segundos de video, tipo de estudio. */
  detail: Record<string, unknown>;
  result: Record<string, unknown>;
  sources: CreditSource[];
  credits: number | null;
  name: string | null;
  expiresAt: string | null;
  loadedBy: string | null;
  reason: string | null;
};

/** Cuántos meses abarca una consulta de la bitácora, como en el backend. */
export const CREDIT_LOG_MAX_MONTHS = 12;

export type CreditLogFilters = {
  company: string | null;
  email: string | null;
  module: CreditModule | null;
  kind: CreditLogKind | null;
  /** `AAAA-MM-DD`. Sin fechas, el mes en curso. */
  from: string | null;
  to: string | null;
  page: number;
};

export type CreditLogPage = { rows: CreditLogRow[]; page: PageInfo };

/** Los asientos nuevos de una empresa, con el porqué que queda en la auditoría. */
export type SeatsChange = { seats: number; reason: string };
export type SeatsChanged = { before: number | null; after: number };
