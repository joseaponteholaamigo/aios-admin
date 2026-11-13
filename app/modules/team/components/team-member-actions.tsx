// Lo que el superadministrador puede hacer con una persona del equipo, según su estado (spec «Equipo
// ENSŌ», CA-18). Cada acción abre su diálogo de confirmación; nada se hace con un clic.
import { useRef, useState } from 'react';
import type { WriteRejection } from '../../../domain/account-creation';
import { teamActionsFor, type TeamAction, type TeamPerson } from '../../../domain/team';
import { ACTION_TEXTS, displayName } from '../team-labels';
import { TeamActionDialog } from './team-action-dialog';
import './team-member-actions.css';

type Props = {
  person: TeamPerson;
  /** El rechazo del último intento y de qué acción era: vuelve a abrir su diálogo, con el rechazo. */
  rejection: WriteRejection | null;
  rejectedAction: TeamAction | null;
};

export function TeamMemberActions({ person, rejection, rejectedAction }: Props) {
  const actions = teamActionsFor(person);
  const [open, setOpen] = useState<TeamAction | null>(rejection && rejectedAction && actions.includes(rejectedAction) ? rejectedAction : null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  if (actions.length === 0) return null;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Acciones</h2><p>Cada una pide un motivo, que queda en su historia.</p></div></div>
      <div className="card-b">
        {/* Los botones en su propio contenedor: el espaciado de `.card-b` entre hijos los desalineaba. */}
        <div className="team-member-actions">
        {actions.map((action) => (
          <button
            key={action} type="button"
            className={ACTION_TEXTS[action].danger ? 'btn team-member-actions__danger' : 'btn'}
            onClick={(e) => { trigger.current = e.currentTarget; setOpen(action); }}
          >
            {ACTION_TEXTS[action].label}
          </button>
        ))}
        </div>
      </div>
      {open && (
        <TeamActionDialog
          key={open} action={open} name={displayName(person)} version={person.version}
          rejection={open === rejectedAction ? rejection : null}
          onClose={() => { setOpen(null); trigger.current?.focus(); }}
        />
      )}
    </section>
  );
}
