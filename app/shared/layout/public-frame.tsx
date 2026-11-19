// El marco de las páginas sin sesión (el login fallido, «sin acceso») y de los errores: con los
// tokens y la marca, sin menú (CA-23).
import type { ReactNode } from 'react';
import logoDark from './brand/enso-blanco-56.png';
import logoLight from './brand/enso-negro-56.png';
import './public-frame.css';

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="adm-public">
      <div className="adm-public__brand">
        <img src={logoLight} alt="" className="logo-light" />
        <img src={logoDark} alt="" className="logo-dark" />
        <b>ensō OS</b>
      </div>
      {children}
    </div>
  );
}
