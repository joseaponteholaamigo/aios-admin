// El tema del panel: claro, oscuro o el del sistema (CA-25).
//
// La preferencia vive solo en el navegador (`localStorage`), nunca en la sesión: es una comodidad
// de quien mira, no un dato de nadie. Sin preferencia, el CSS sigue al sistema
// (`prefers-color-scheme`); con ella, `data-theme` en <html> gana.

/** La misma clave que usa el sitio (`ThemeInit.astro` de beenso). */
export const THEME_STORAGE_KEY = 'enso-theme';

export type Theme = 'light' | 'dark';

/**
 * Lo que corre en el <head> antes de pintar, para que quien eligió oscuro no vea un destello claro.
 * Si el navegador no deja leer `localStorage` (Safari en privado lanza), manda el sistema.
 */
export const THEME_INIT_SCRIPT =
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  'if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}})();';

/** El tema al que pasa el botón: el contrario del que se ve, sea elegido o del sistema. */
export function toggledTheme(current: string | undefined, systemPrefersDark: boolean): Theme {
  const showingDark = current === 'dark' || current === 'light' ? current === 'dark' : systemPrefersDark;
  return showingDark ? 'light' : 'dark';
}
