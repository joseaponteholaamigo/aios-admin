// El aviso de Empresas cuando hay borrados de cuentas que no terminaron (spec «Borrar cuentas y
// destrabar personas», CA-27), con un enlace a la confirmación de cada uno para terminarlo.
import { Link } from 'react-router';
import type { PendingDeletion } from '../../../domain/account-deletion';
import { Icon } from '../../../shared/icons/icon';
import { formatDateTime } from '../../../shared/ui/format';

export function PendingDeletionsNotice({ pending }: { pending: PendingDeletion[] }) {
  if (pending.length === 0) return null;
  return (
    <div className="banner" role="status">
      <Icon name="alert" />
      <div>
        <p>Hay borrados sin terminar. Ábrelos para terminarlos:</p>
        <ul>
          {pending.map((p) => (
            <li key={p.id}><Link to={`/companies/${encodeURIComponent(p.id)}/delete`} className="mono">{p.id}</Link> · desde el {formatDateTime(p.startedAt)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
