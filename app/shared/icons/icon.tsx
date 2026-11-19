// Un ícono del panel, con el mismo `<svg>` que armaba `icono()` en el panel viejo.
import { ICON_PATHS, type IconName } from './icon-paths';

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // Trazos fijos del código (`icon-paths.ts`), nunca datos de un pedido.
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
