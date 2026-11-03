// La auditoría del equipo, como la ve Gobernanza (M2a).
import type { PageInfo } from './pagination';

export type AuditEvent = {
  at: string;
  actor: string;
  channel: string;
  operation: string;
  /** Sobre qué cae: `tenant#<id>`, `equipo#<sub>`… */
  target: string;
  reason: string | null;
  before: unknown;
  after: unknown;
};

export type AuditPage = { events: AuditEvent[]; page: PageInfo; onlySome: boolean };
