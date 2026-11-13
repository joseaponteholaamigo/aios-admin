// Quién es una persona del equipo: su correo, su papel, su estado y su invitación (spec «Equipo
// ENSŌ», CA-4).
import type { TeamPerson } from '../../../domain/team';
import { badgeClass } from '../../../shared/ui/badge';
import { FactList } from '../../../shared/ui/fact-list';
import { INVITATION_LABELS, roleLabel, statusLabel } from '../team-labels';

export function TeamMemberFacts({ person }: { person: TeamPerson }) {
  const role = roleLabel(person);
  const status = statusLabel(person);
  const invitation = person.invitation ? INVITATION_LABELS[person.invitation] : null;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Persona</h2></div></div>
      <div className="card-b">
        <FactList facts={[
          { label: 'Correo', value: <span className="mono">{person.email ?? '—'}</span> },
          { label: 'Papel', value: <span className={badgeClass(role.tone)}>{role.text}</span> },
          { label: 'Estado', value: <span className={badgeClass(status.tone)}>{status.text}</span> },
          {
            label: 'Invitación',
            value: invitation ? <span className={badgeClass(invitation.tone)}>{invitation.text}</span> : person.invitation === 'accepted' ? 'Ya entró' : '—',
          },
        ]} />
      </div>
    </section>
  );
}
