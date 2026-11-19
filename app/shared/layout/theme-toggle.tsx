// El botón de la barra superior que alterna entre el tema claro y el oscuro.
import { Icon } from '../icons/icon';
import { THEME_STORAGE_KEY, toggledTheme } from './theme';

function toggleTheme() {
  const root = document.documentElement;
  const next = toggledTheme(root.dataset.theme, matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Sin `localStorage` el cambio vale hasta recargar: es una comodidad, no un dato.
  }
}

export function ThemeToggle() {
  return (
    <button type="button" className="adm-iconbtn tip-abajo" aria-label="Cambiar tema" data-tip="Tema claro / oscuro" onClick={toggleTheme}>
      <Icon name="sun" />
    </button>
  );
}
