// El marco de toda pantalla con sesión: la barra lateral, la barra superior y el contenido (CA-23).
// En el teléfono, el menú se abre desde la barra superior y se cierra al elegir, al tocar fuera o
// con Escape.
import { useEffect, useState, type ReactNode } from 'react';
import type { MenuItem } from '../routing/route-access';
import { SideNav } from './side-nav';
import { TopBar, type ShellMember } from './top-bar';
import './app-shell.css';

export function AppShell({ member, menu, children }: { member: ShellMember; menu: MenuItem[]; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  return (
    <div className="adm-shell">
      <SideNav items={menu} open={menuOpen} onNavigate={closeMenu} />
      {menuOpen && <div className="adm-scrim" aria-hidden="true" onClick={closeMenu} />}
      <div className="adm-main">
        <TopBar member={member} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
        <main className="adm-page">{children}</main>
      </div>
    </div>
  );
}
