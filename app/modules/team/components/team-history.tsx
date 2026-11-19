// La historia de una persona del equipo: sus eventos de auditoría, el más reciente primero, con quién
// hizo cada cosa y su motivo (spec «Equipo ENSŌ», CA-19).
import type { AuditEvent } from '../../../domain/audit';
import { Timeline } from '../../../shared/ui/timeline';
import { OPERATION_LABELS } from '../team-labels';

/** `names`: el nombre de cada actor del equipo (`equipo:<sub>`), para decir quién lo hizo. */
export function TeamHistory({ events, names }: { events: AuditEvent[]; names: Record<string, string> }) {
  const items = events.map((e, i) => ({
    key: `${e.at}-${i}`,
    at: e.at,
    title: OPERATION_LABELS[e.operation] ?? e.operation,
    detail: `por ${names[e.actor] ?? e.actor}${e.reason ? ` · ${e.reason}` : ''}`,
  }));
  return (
    <section className="card">
      <div className="card-h"><div><h2>Historia</h2><p>Lo más reciente primero.</p></div></div>
      <div className="card-b"><Timeline items={items} empty="Todavía no hay nada anotado para esta persona." /></div>
    </section>
  );
}
