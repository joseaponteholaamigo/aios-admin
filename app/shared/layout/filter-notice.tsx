// El aviso de que el panel muestra solo algunas empresas: el filtro de M2a, hasta la revisión de
// seguridad (CA-4). Lo decide el backend en cada respuesta de lista (`soloAlgunas`).
import { Icon } from '../icons/icon';

export function FilterNotice({ onlySome }: { onlySome: boolean }) {
  if (!onlySome) return null;
  return (
    <div className="banner info" role="note">
      <Icon name="info" />
      <p>Por ahora el panel muestra solo las empresas de prueba.</p>
    </div>
  );
}
