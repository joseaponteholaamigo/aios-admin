// Lo que encontró la búsqueda por correo, en el lugar de la lista: la persona como una fila de la
// misma tabla, o que no está. La búsqueda mira todas las empresas, y la frase lo dice: el filtro de
// empresa no la afecta.
import { Link } from 'react-router';
import type { PersonSearch } from '../../../domain/client-users';
import { ClientUsersTable } from './client-users-table';
import './search-outcome.css';

type Props = { result: PersonSearch; email: string; backTo: string };

export function SearchOutcome({ result, email, backTo }: Props) {
  const back = <Link className="btn sm soft" to={backTo}>Ver la lista</Link>;
  if (!result.found) {
    return (
      <div className="search-outcome" role="status">
        <p className="empty">
          No encontramos a nadie con el correo {email}{result.onlySome ? ' en las empresas que el panel muestra' : ''}. La búsqueda es por el correo exacto: revisa que esté completo.
        </p>
        {back}
      </div>
    );
  }
  return (
    <div className="search-outcome" role="status">
      <p className="muted small">Resultado de buscar {email} en todas las empresas. {back}</p>
      <ClientUsersTable people={[{ ...result.seat, company: result.company }]} emptyMessage="" />
    </div>
  );
}
