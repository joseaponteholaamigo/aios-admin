// Las personas del equipo ensō, con su papel, su estado y sus módulos.
import { grantedModules, type TeamMember } from '../../../domain/permissions';
import { LEVEL_LABELS, MODULE_LABELS } from '../../../shared/labels/permission-labels';

export function TeamTable({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return <p className="empty">Todavía no hay nadie en el equipo.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Persona</th><th>Papel</th><th>Estado</th><th>Módulos</th></tr></thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.actor}>
              <td>
                <b>{member.name ?? member.email ?? member.actor}</b>
                <div className="tiny mono muted">{member.email ?? member.actor}</div>
              </td>
              <td>{member.isSuperadmin ? <span className="badge accent">Superadministrador</span> : <span className="badge">Equipo</span>}</td>
              <td>{member.status === 'active' ? <span className="badge ok">Activa</span> : <span className="badge warn">Suspendida</span>}</td>
              <td>
                {member.isSuperadmin ? <span className="small muted">Todos</span> : (
                  <ul className="chips" aria-label="Módulos">
                    {/* Los que puede usar si vuelve a estar activa: los de su fila, con su nivel. */}
                    {grantedModules({ ...member, status: 'active' }).map(({ module, level }) => (
                      <li key={module} className={level === 'edit' ? 'chip accent' : 'chip'}>{MODULE_LABELS[module]}: {LEVEL_LABELS[level]}</li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
