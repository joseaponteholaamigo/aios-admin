// El script del tema, en el <head>: corre antes de pintar y lleva el nonce de la CSP del pedido.
import { useContext } from 'react';
import { CspNonceContext } from './csp-nonce-context';
import { THEME_INIT_SCRIPT } from './theme';

export function ThemeScript() {
  const nonce = useContext(CspNonceContext);
  // `suppressHydrationWarning`: el navegador esconde el valor del nonce después de leerlo, y React
  // vería una diferencia que no lo es.
  return <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
