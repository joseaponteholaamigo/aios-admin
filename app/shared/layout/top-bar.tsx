// La barra superior del panel viejo: el botón del menú (en el teléfono), el tema, quién entró y la
// salida (CA-23). El buscador y el resumen del panel viejo no están: sus datos no existen en M2a.
import { Icon } from '../icons/icon';
import { SignOutButton } from './sign-out-button';
import { SIDE_NAV_ID } from './side-nav';
import { ThemeToggle } from './theme-toggle';
import './top-bar.css';

export type ShellMember = { name: string; isSuperadmin: boolean };

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || '·';

export function TopBar({ member, menuOpen, onToggleMenu }: { member: ShellMember; menuOpen: boolean; onToggleMenu: () => void }) {
  return (
    <header className="adm-top">
      <button
        type="button"
        className="adm-iconbtn adm-menu"
        aria-label="Abrir menú"
        aria-expanded={menuOpen}
        aria-controls={SIDE_NAV_ID}
        onClick={onToggleMenu}
      >
        <Icon name="menu" />
      </button>
      <div className="adm-me">
        <ThemeToggle />
        <div>
          {member.name}
          <small>{member.isSuperadmin ? 'Superadministrador' : 'Equipo ensō'}</small>
        </div>
        <span className="adm-avatar" aria-hidden="true">{initialOf(member.name)}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
