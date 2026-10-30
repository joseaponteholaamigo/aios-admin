// La lista de Usuarios de clientes: cada persona con su empresa, su rol y su estado. La empresa lleva
// a sus personas, donde se ve además qué recibe cada una. Una cuenta personal no es una empresa:
// dice «Cuenta personal» en vez del nombre que se le puso al darla de alta.
import { Link } from 'react-router';
import type { ClientUser } from '../../../domain/client-users';
import { CompanyBadge } from '../../../shared/ui/company-badge';
import { formatDate } from '../../../shared/ui/format';
import { badgeClass, roleLabel, seatStatusLabel } from '../client-user-labels';

/** `emptyMessage`: qué decir sin nadie, que depende del filtro y de la página (`emptyListMessage`). */
export function ClientUsersTable({ people, emptyMessage }: { people: ClientUser[]; emptyMessage: string }) {
  if (people.length === 0) return <p className="empty">{emptyMessage}</p>;
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
                <td>
                  {person.company.kind === 'personal'
                    ? <Link className="badge accent" to={`/client-users/${person.company.id}`}>Cuenta personal</Link>
                    : <CompanyBadge id={person.company.id} name={person.company.name} to={`/client-users/${person.company.id}`} />}
                </td>
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
