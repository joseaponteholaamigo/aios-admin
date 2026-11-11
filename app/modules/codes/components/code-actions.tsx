// Pausar, reanudar o revocar un código (spec «Códigos de registro», CA-5). Solo con «editar» en
// Códigos. Revocar no se deshace: quienes ya canjearon conservan su plan (CB-14).
import { Form } from 'react-router';
import type { WriteRejection } from '../../../domain/account-creation';
import { actionsFor, type RegistrationCode } from '../../../domain/codes';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { ACTION_LABELS } from '../code-labels';
import './code-actions.css';

export const ACTION_FIELD = 'accion';

export function CodeActions({ code, rejection }: { code: RegistrationCode; rejection: WriteRejection | null }) {
  const actions = actionsFor(code);
  if (actions.length === 0) return null;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Acciones</h2>
        <p>{code.pausedBy === 'brake' ? 'Lo pausó el freno del día: reanúdalo si las reservas son legítimas, o revócalo si se filtró.' : 'Pausado, nadie puede reservarlo; revocado, ya no vuelve.'}</p></div></div>
      <div className="card-b">
        {rejection && <FormRejection rejection={rejection} />}
        <Form method="post" className="code-actions">
          <div className="field">
            <label htmlFor="reason">Motivo (opcional)</label>
            <input id="reason" name="reason" maxLength={500} placeholder="Para la auditoría del equipo" />
          </div>
          <div className="code-actions__buttons">
            {actions.map((action) => (
              <SubmitButton key={action} name={ACTION_FIELD} value={action} label={ACTION_LABELS[action].label} busyLabel={ACTION_LABELS[action].busy}
                className={action === 'revoke' ? 'btn code-actions__revoke' : action === 'resume' ? 'btn primary' : 'btn'} />
            ))}
          </div>
        </Form>
      </div>
    </section>
  );
}
