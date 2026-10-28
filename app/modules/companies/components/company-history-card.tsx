// La historia de una empresa en su ficha: su bitácora de cuenta y lo que la auditoría dice de
// ella, de lo más nuevo a lo más viejo.
import type { CompanyHistoryEvent } from '../../../domain/companies';
import { Timeline } from '../../../shared/ui/timeline';

const SOURCES = { account: 'cuenta', audit: 'auditoría' } as const;

export function CompanyHistoryCard({ history }: { history: CompanyHistoryEvent[] }) {
  const items = history.map((event, i) => ({
    key: `${event.at}-${i}`,
    at: event.at,
    title: (
      <span>
        <code>{event.what}</code> <span className="chip">{SOURCES[event.source]}</span>
      </span>
    ),
    detail: [event.actor ?? 'sin actor', event.reason].filter(Boolean).join(' · '),
  }));
  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Historia</h2>
          <p>Quién cambió qué, cuándo y por qué.</p>
        </div>
      </div>
      <div className="card-b">
        <Timeline items={items} empty="Todavía no hay nada anotado para esta empresa." />
      </div>
    </section>
  );
}
