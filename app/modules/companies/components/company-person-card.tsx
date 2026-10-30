// La persona de una cuenta personal, en su ficha: su correo, el estado de su asiento y cuándo la
// invitaron y entró (spec «Cuentas personales», CA-22). Ocupa el lugar de la parte de equipo.
import type { AccountPerson } from '../../../domain/companies';
import { seatStatusLabel } from '../../../shared/labels/seat-status-labels';
import { badgeClass } from '../../../shared/ui/badge';
import { FactList } from '../../../shared/ui/fact-list';
import { formatDate } from '../../../shared/ui/format';

export function CompanyPersonCard({ person }: { person: AccountPerson | null }) {
  const status = person ? seatStatusLabel(person.status) : null;
  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Persona</h2>
          <p>Quien entra a ENSŌ con esta cuenta.</p>
        </div>
      </div>
      <div className="card-b">
        {person && status
          ? (
            <FactList facts={[
              { label: 'Correo', value: person.email },
              { label: 'Estado', value: <span className={badgeClass(status.tone)}>{status.text}</span> },
              { label: 'Invitada', value: formatDate(person.invitedAt) },
              { label: 'Entró', value: person.acceptedAt ? formatDate(person.acceptedAt) : 'Todavía no' },
            ]} />
          )
          : <p className="empty">Esta cuenta no tiene a nadie: nadie puede entrar a ENSŌ con ella.</p>}
      </div>
    </section>
  );
}
