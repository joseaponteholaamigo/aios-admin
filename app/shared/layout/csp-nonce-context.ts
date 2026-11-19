// El nonce de la CSP del pedido, para los scripts que el panel pone por su cuenta (el del tema).
//
// ⚠️ Lo pone `entry.server.tsx` y no el loader de la raíz: una ruta que no existe (404) se responde
// sin loaders, y ahí el script quedaría sin nonce y la CSP lo bloquearía. En el navegador no hay
// valor: el script ya corrió y React solo hidrata.
import { createContext } from 'react';

export const CspNonceContext = createContext<string | undefined>(undefined);
