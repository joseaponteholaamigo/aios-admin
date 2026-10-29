// La lista de Usuarios de clientes: cada persona con su empresa, su rol y su estado. La empresa lleva
// a sus personas, donde se ve además qué recibe cada una.
import type { ClientUser } from '../../../domain/client-users';
import { CompanyBadge } from '../../../shared/ui/company-badge';
import { formatDate } from '../../../shared/ui/format';
import { badgeClass, roleLabel, seatStatusLabel } from '../client-user-labels';

/**
 * `laterPage`: no es la primera página. Ahí una página vacía no quiere decir que no haya nadie: sus
 * entradas estaban muertas (las muestra la revisión de datos), o la lista ya terminó.
 */
export function ClientUsersTable({ people, laterPage }: { people: ClientUser[]; laterPage: boolean }) {
  if (people.length === 0) {
    return <p className="empty">{laterPage ? 'En esta página no quedan personas vigentes.' : 'Todavía no hay personas para mostrar.'}</p>;
  }
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Correo</th><th>Empresa</th><th>Rol</th><th>Estado</th><th>Invitada</th><th>Entró</th></tr></thead>
        <tbody>
          {people.map((person) => {
            const status = seatStatusLabel(person.status);
            return (
              <tr key={person.email}>
                <td className="small">{person.email}</td>
                <td><CompanyBadge id={person.company.id} name={person.company.name} to={`/client-users/${person.company.id}`} /></td>
                <td className="small">{roleLabel(person)}</td>
                <td><span className={badgeClass(status.tone)}>{status.text}</span></td>
                <td className="small">{formatDate(person.invitedAt)}</td>
                <td className="small">{formatDate(person.acceptedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
