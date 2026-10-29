// Las personas de los clientes y la revisión de datos, como las ve el panel (M2a).

export type ItemCounts = { skills: number; agents: number; chains: number };

/** El estado de un asiento. `unknown`: uno que el backend agregó y el panel todavía no conoce. */
export type SeatStatus = 'active' | 'invited' | 'paused' | 'revoked' | 'unknown';

/** De qué parte un rol: lo de la empresa o nada. */
export type RoleBase = 'company' | 'nothing' | 'unknown';

/** Qué ve una persona, en las palabras de la columna «Ve» de «Mi equipo». */
export type PersonSees =
  | { kind: 'admin' }
  | { kind: 'role'; role: string; adjustments: number }
  | { kind: 'everything'; adjustments: number }
  | { kind: 'chosen'; chosen: number }
  | { kind: 'missing-role'; role: string }
  | { kind: 'unknown' };

export type ClientPerson = {
  email: string;
  role: string | null;
  isAdmin: boolean;
  status: SeatStatus;
  sees: PersonSees;
  counts: ItemCounts;
  invitedAt: string | null;
  acceptedAt: string | null;
};

export type ClientRole = { slug: string; label: string; base: RoleBase; empty: boolean; people: number; rules: number };

export type GovernanceEntry = { action: string; actor: string | null; about: string | null; at: string };

export type CompanyDomain = { slug: string; skills: string[] };

export type CompanyPeople = {
  company: { id: string; name: string };
  domains: CompanyDomain[];
  counts: ItemCounts;
  roles: ClientRole[];
  people: ClientPerson[];
  revoked: { email: string; revokedAt: string | null }[];
  log: GovernanceEntry[];
};

/** La ficha de un asiento, como la da la búsqueda por correo. */
export type SeatCard = {
  email: string;
  role: string | null;
  isAdmin: boolean;
  status: SeatStatus;
  invitedAt: string | null;
  acceptedAt: string | null;
};

export type PersonSearch =
  | { found: false; onlySome: boolean }
  | { found: true; company: { id: string; name: string }; seat: SeatCard; onlySome: boolean };

/** Una persona de la lista de Usuarios de clientes: su asiento y la empresa donde lo tiene. */
export type ClientUser = SeatCard & { company: { id: string; name: string } };

/** Una empresa en el filtro de la lista. `hasTeam`: su plan es de más de un asiento. */
export type CompanyOption = { id: string; name: string; hasTeam: boolean };

export type ClientUsersPage = { people: ClientUser[]; next: string | null; companies: CompanyOption[]; onlySome: boolean };

/** Los tipos de hallazgo de la revisión de datos (el doctor del backend). */
export const FINDING_KINDS = [
  'orphanCredentials',
  'companiesWithoutCredential',
  'withoutPublishCredential',
  'seatsWithoutIndex',
  'seatsInAnotherCompany',
  'staleIndexes',
  'companiesWithoutAdmin',
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

/** Un hallazgo: de qué empresa, a veces de qué persona, y lo que lo describe. */
export type Finding = { companyId: string; email: string | null; detail: string | null };

export type DataCheckup = {
  findings: Record<FindingKind, Finding[]>;
  total: number;
  outsideVisible: number;
  onlySome: boolean;
};
