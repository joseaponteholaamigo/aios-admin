// La lista de Usuarios de clientes: cada persona con su empresa, su rol y su estado. La fila lleva a
// las personas de su empresa, donde se ve además qué recibe cada una y qué se le puede hacer: con un
// clic en cualquier parte, como en Empresas. Una cuenta personal no es una empresa: dice «Cuenta
// personal» en vez del nombre que se le puso al darla de alta.
import { Link } from 'react-router';
import type { ClientUser } from '../../../domain/client-users';
import { CompanyBadge } from '../../../shared/ui/company-badge';
import { formatDate } from '../../../shared/ui/format';
import { LinkedRow } from '../../../shared/ui/linked-row';
import { badgeClass, roleLabel, seatStatusLabel } from '../client-user-labels';

const peopleOf = (person: ClientUser) => `/client-users/${person.company.id}`;

/** Qué abre «Abrir», para el lector de pantalla: sin esto, oye «Abrir» igual en cada fila. */
const openLabel = (person: ClientUser) =>
  `Abrir ${person.company.kind === 'personal' ? 'la cuenta personal' : 'la empresa'} de ${person.email}`;

/** `emptyMessage`: qué decir sin nadie, que depende del filtro y del total de la lista (`emptyListMessage`). */
export function ClientUsersTable({ people, emptyMessage }: { people: ClientUser[]; emptyMessage: string }) {
  if (people.length === 0) return <p className="empty">{emptyMessage}</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Correo</th><th>Empresa</th><th>Rol</th><th>Estado</th><th>Invitada</th><th>Entró</th><th /></tr></thead>
        <tbody>
          {people.map((person) => {
            const status = seatStatusLabel(person.status);
            return (
              <LinkedRow key={person.email} to={peopleOf(person)}>
                <td className="small">{person.email}</td>
                <td>
                  {person.company.kind === 'personal'
                    ? <Link className="badge accent" to={peopleOf(person)}>Cuenta personal</Link>
                    : <CompanyBadge id={person.company.id} name={person.company.name} to={peopleOf(person)} size="sm" />}
                </td>
                <td className="small">{roleLabel(person)}</td>
                <td><span className={badgeClass(status.tone)}>{status.text}</span></td>
                <td className="small">{formatDate(person.invitedAt)}</td>
                <td className="small">{formatDate(person.acceptedAt)}</td>
                <td><Link className="btn sm soft" to={peopleOf(person)} aria-label={openLabel(person)}>Abrir</Link></td>
              </LinkedRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
