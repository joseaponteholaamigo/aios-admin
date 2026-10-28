// Los roles de una empresa, como en «Mi equipo»: de qué parten, cuántas reglas tienen y cuántas
// personas los usan.
import type { ClientRole, RoleBase } from '../../../domain/client-users';

const BASES: Record<RoleBase, string> = { company: 'Lo de la empresa', nothing: 'Nada', unknown: '—' };

export function RolesTable({ roles }: { roles: ClientRole[] }) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Roles</h2><p>Los que armó su admin en «Mi equipo».</p></div></div>
      <div className="card-b">
        {roles.length === 0 ? <p className="empty">Esta empresa no tiene roles: cada persona ve lo de la empresa.</p> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Rol</th><th>Parte de</th><th className="num">Reglas</th><th className="num">Personas</th></tr></thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.slug}>
                    <td>{role.label} {role.empty && <span className="badge warn">vacío</span>}</td>
                    <td className="small">{BASES[role.base]}</td>
                    <td className="num">{role.rules}</td>
                    <td className="num">{role.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
