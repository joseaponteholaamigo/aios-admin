// Las personas del equipo ensō, con su papel, su estado, su invitación y sus módulos (spec «Equipo
// ENSŌ», CA-14). Un clic en cualquier parte de la fila abre a la persona.
import { Link } from 'react-router';
import { grantedModules } from '../../../domain/permissions';
import type { TeamPerson } from '../../../domain/team';
import { LEVEL_LABELS, MODULE_LABELS } from '../../../shared/labels/permission-labels';
import { modulesWithScreen } from '../../../shared/routing/route-access';
import { badgeClass } from '../../../shared/ui/badge';
import { LinkedRow } from '../../../shared/ui/linked-row';
import { INVITATION_LABELS, displayName, roleLabel, statusLabel } from '../team-labels';

const CON_PANTALLA = new Set(modulesWithScreen());

export function TeamTable({ people, empty }: { people: TeamPerson[]; empty: string }) {
  if (people.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Persona</th><th>Papel</th><th>Estado</th><th>Módulos</th></tr></thead>
        <tbody>
          {people.map((person) => {
            const role = roleLabel(person);
            const status = statusLabel(person);
            const invitation = person.invitation ? INVITATION_LABELS[person.invitation] : null;
            return (
              <LinkedRow key={person.actor} to={`/team/${encodeURIComponent(person.sub)}`}>
                <td>
                  {/* El enlace es el camino con teclado y lector de pantalla: la fila entera solo responde al clic. */}
                  <Link to={`/team/${encodeURIComponent(person.sub)}`}><b>{displayName(person)}</b></Link>
                  <div className="tiny mono muted">{person.email ?? person.sub}</div>
                </td>
                <td><span className={badgeClass(role.tone)}>{role.text}</span></td>
                <td>
                  <span className={badgeClass(status.tone)}>{status.text}</span>
                  {invitation && <> <span className={badgeClass(invitation.tone)}>{invitation.text}</span></>}
                  {/* CB-12: sin respuesta del login, la invitación no se sabe. */}
                  {person.invitation === null && person.status !== 'retired' && <span className="small muted"> · invitación: —</span>}
                </td>
                <td>
                  {person.isSuperadmin ? <span className="small muted">Todos</span> : (
                    <ul className="chips" aria-label="Módulos">
                      {/* Los que puede usar si vuelve a estar activa, y solo los que tienen pantalla (decisión 3). */}
                      {grantedModules({ ...person, status: 'active' }).filter(({ module }) => CON_PANTALLA.has(module)).map(({ module, level }) => (
                        <li key={module} className={level === 'edit' ? 'chip accent' : 'chip'}>{MODULE_LABELS[module]}: {LEVEL_LABELS[level]}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </LinkedRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
