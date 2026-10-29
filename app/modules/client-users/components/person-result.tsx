// El resultado de buscar a una persona por su correo: su empresa y la ficha de su asiento, o que
// no está. «No está» incluye a quien está en una empresa que el panel todavía no muestra.
import { Link } from 'react-router';
import type { PersonSearch } from '../../../domain/client-users';
import { CompanyBadge } from '../../../shared/ui/company-badge';
import { FactList } from '../../../shared/ui/fact-list';
import { formatDate } from '../../../shared/ui/format';
import { badgeClass, roleLabel, seatStatusLabel } from '../client-user-labels';

export function PersonResult({ result }: { result: PersonSearch }) {
  if (!result.found) {
    return <p className="empty">No encontramos a nadie con ese correo{result.onlySome ? ' en las empresas que el panel muestra' : ''}.</p>;
  }
  const { company, seat } = result;
  const status = seatStatusLabel(seat.status);
  return (
    <section className="card" aria-label="Persona encontrada">
      <div className="card-h">
        <CompanyBadge id={company.id} name={company.name} />
        <Link className="btn sm soft" to={`/client-users/${company.id}`}>Ver todas sus personas</Link>
      </div>
      <div className="card-b">
        <FactList facts={[
          { label: 'Correo', value: seat.email },
          { label: 'Estado', value: <span className={badgeClass(status.tone)}>{status.text}</span> },
          { label: 'Rol', value: roleLabel(seat) },
          { label: 'Invitada', value: formatDate(seat.invitedAt) },
          { label: 'Entró por primera vez', value: formatDate(seat.acceptedAt) },
        ]} />
      </div>
    </section>
  );
}
