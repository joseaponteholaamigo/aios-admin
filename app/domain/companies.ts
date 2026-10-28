// Las empresas, como las ve el panel (M2a). Los nombres del backend se traducen solo en
// `app/shared/api/`: aquí no aparece ninguno.

/** El plan contratado: `custom` es el Personalizado; otro valor es un tier del backend. */
export type CompanyPlan = 'custom' | 'free' | 'pro' | 'team' | string;

export type Company = {
  id: string;
  name: string;
  plan: CompanyPlan | null;
  /** El estado del backend tal cual (`active`, `revoked`, `canceled`…). */
  status: string | null;
  expiry: { expired: boolean; expiredBy: 'subscription' | 'date' | null; until: string | null };
  /** El aviso de vencimiento, ya redactado por el backend (`vence el 1 nov`), o `null`. */
  notice: string | null;
  seats: { used: number; cap: number | null };
  admins: number;
  paysWithStripe: boolean;
  createdAt: string | null;
};

export type CompaniesPage = { companies: Company[]; next: string | null; onlySome: boolean };

/** Los cupos de un plan por nombre (`radar`, `projects`, `skills`, `chains`); `null` es sin tope. */
export type Quotas = Record<string, number | null>;

export type EffectivePlan = {
  tier: string | null;
  preset: string | null;
  flags: { collaboration: boolean; scheduling: boolean };
  quotas: Quotas;
  seats: number | null;
  managesSeats: boolean;
};

/** De qué contenido parte una empresa antes de sus reglas: todo, lo de Free o nada. */
export type ContentBase = 'everything' | 'free' | 'nothing';

/** Una regla de acceso de empresa: dar o quitar una skill o un dominio. */
export type AccessRule = { key: string; action: 'grant' | 'remove' | 'unknown'; missing: boolean; inactive: boolean };

export type CompanyAccess = {
  base: ContentBase | null;
  rules: AccessRule[];
  counts: { skills: number; agents: number; chains: number };
};

/** Lo que se acordó con un cliente Personalizado. */
export type CustomConditions = {
  seats: number | null;
  content: ContentBase | null;
  team: boolean | null;
  scheduling: boolean | null;
  until: string | null;
  quotas: Quotas;
};

export type CompanyFile = Company & {
  effectivePlan: EffectivePlan | null;
  /** Las condiciones de un Personalizado; `null` en los demás planes. */
  conditions: CustomConditions | null;
  access: CompanyAccess | null;
  /** Por qué no se pudo calcular el acceso (falta publicar algo), cuando `access` es `null`. */
  accessPending: string | null;
};

export type CompanyHistoryEvent = {
  source: 'account' | 'audit';
  at: string;
  actor: string | null;
  what: string;
  reason: string | null;
  channel: string | null;
  detail: unknown;
  before: unknown;
  after: unknown;
};
