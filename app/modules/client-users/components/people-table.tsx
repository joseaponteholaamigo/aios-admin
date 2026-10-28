// Las personas de una empresa: su rol, su estado, qué ven y cuánto reciben, como en «Mi equipo»,
// más cuándo las invitaron y cuándo entraron.
import type { ClientPerson, ClientRole } from '../../../domain/client-users';
import { formatDate } from '../../../shared/ui/format';
import { badgeClass, countsLabel, seatStatusLabel, seesLabel } from '../client-user-labels';

export function PeopleTable({ people, roles }: { people: ClientPerson[]; roles: ClientRole[] }) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Personas</h2><p>Las que hoy ocupan un asiento o lo tienen en pausa.</p></div></div>
      <div className="card-b">
        {people.length === 0 ? <p className="empty">Esta empresa todavía no tiene personas.</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Correo</th><th>Estado</th><th>Ve</th><th>Recibe</th><th>Invitada</th><th>Entró</th></tr></thead>
              <tbody>
                {people.map((person) => {
                  const status = seatStatusLabel(person.status);
                  return (
                    <tr key={person.email}>
                      <td className="small">{person.email}{person.isAdmin && <> <span className="badge accent">admin</span></>}</td>
                      <td><span className={badgeClass(status.tone)}>{status.text}</span></td>
                      <td className="small">
                        {person.sees.kind === 'missing-role' ? <span className="badge bad">{seesLabel(person.sees, roles)}</span> : seesLabel(person.sees, roles)}
                      </td>
                      <td className="small mono">{countsLabel(person.counts)}</td>
                      <td className="small">{formatDate(person.invitedAt)}</td>
                      <td className="small">{formatDate(person.acceptedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
