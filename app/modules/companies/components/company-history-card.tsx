// La historia de una empresa en su ficha: su bitácora de cuenta y lo que la auditoría dice de
// ella, de lo más nuevo a lo más viejo. Un evento que trae el antes y el después los muestra (spec
// «Editar cuentas y personas», CA-4). Los que el panel sabe nombrar llevan su nombre en palabras junto al
// técnico (spec «Revocar y reactivar una cuenta», CA-15).
import type { CompanyHistoryEvent } from '../../../domain/companies';
import { Timeline } from '../../../shared/ui/timeline';
import { HISTORY_EVENT_LABELS } from '../account-status-labels';
import { changeLines } from '../history-change';
import './company-history-card.css';

const SOURCES = { account: 'cuenta', audit: 'auditoría' } as const;

function EventDetail({ event }: { event: CompanyHistoryEvent }) {
  const lines = changeLines(event.before, event.after);
  return (
    <>
      {[event.actor ?? 'sin actor', event.reason].filter(Boolean).join(' · ')}
      {lines.length > 0 && (
        <span className="company-history__change">
          {lines.map((line) => <span key={line} className="mono">{line}</span>)}
        </span>
      )}
    </>
  );
}

export function CompanyHistoryCard({ history }: { history: CompanyHistoryEvent[] }) {
  const items = history.map((event, i) => ({
    key: `${event.at}-${i}`,
    at: event.at,
    title: (
      <span>
        {event.kind && <><strong>{HISTORY_EVENT_LABELS[event.kind]}</strong>{' '}</>}
        <code>{event.what}</code> <span className="chip">{SOURCES[event.source]}</span>
      </span>
    ),
    detail: <EventDetail event={event} />,
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
