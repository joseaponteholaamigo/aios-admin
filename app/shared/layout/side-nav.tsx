// La barra lateral del panel viejo: la marca y el menú agrupado en «Administración» y «Negocio»
// (CA-23). El menú llega hecho por `menuFor`, que ya dejó fuera lo que la persona no puede usar:
// aquí solo se agrupa y se pinta.
import { NavLink } from 'react-router';
import { Icon } from '../icons/icon';
import type { MenuItem } from '../routing/route-access';
import { MENU_GROUPS, type MenuGroup } from '../routing/route-table';
import logoDark from './brand/enso-blanco-56.png';
import logoLight from './brand/enso-negro-56.png';
import './side-nav.css';

/** El id de la barra lateral, para que el botón del menú diga qué abre (`aria-controls`). */
export const SIDE_NAV_ID = 'adm-side';

const GROUP_LABELS: Record<MenuGroup, string> = { administration: 'Administración', business: 'Negocio' };

export function SideNav({ items, open, onNavigate }: { items: MenuItem[]; open: boolean; onNavigate: () => void }) {
  return (
    <aside id={SIDE_NAV_ID} className={open ? 'adm-side open' : 'adm-side'}>
      <a className="adm-brand" href="/">
        <img src={logoLight} alt="" className="logo-light" />
        <img src={logoDark} alt="" className="logo-dark" />
        <span>
          <b>ensō OS</b>
          <small>Centro de control</small>
        </span>
        <span className="ver">admin</span>
      </a>
      {MENU_GROUPS.map((group) => {
        const entries = items.filter((item) => item.group === group);
        if (entries.length === 0) return null;
        return (
          <nav key={group} className="adm-nav adm-navgroup" aria-label={GROUP_LABELS[group]}>
            <div className="adm-navlabel">{GROUP_LABELS[group]}</div>
            {entries.map((item) => (
              // El inicio se marca solo en `/`; un módulo, también en sus páginas internas.
              <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onNavigate}>
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        );
      })}
    </aside>
  );
}
