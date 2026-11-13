// Lo que va a ver en el menú una persona con estos permisos (spec «Equipo ENSŌ», CA-16). Sale de la
// misma regla y la misma tabla de rutas que arman el menú de verdad (`menuFor`): si el adelanto y el
// menú pudieran diferir, el adelanto mentiría.
import type { TeamPermissions } from '../../../domain/team';
import { menuFor } from '../../../shared/routing/route-access';

export function MenuPreview({ permissions, isSuperadmin }: { permissions: TeamPermissions; isSuperadmin: boolean }) {
  const items = menuFor({ actor: 'adelanto', email: null, name: null, isSuperadmin, status: 'active', permissions });
  return (
    <div className="menu-preview" aria-live="polite">
      <p className="small muted">Así va a ver el menú:</p>
      <ul className="chips" aria-label="Lo que va a ver en el menú">
        {items.map((item) => <li key={item.path} className="chip">{item.label}</li>)}
      </ul>
    </div>
  );
}
