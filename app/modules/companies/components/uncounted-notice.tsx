// El aviso que va en lugar de los números por origen mientras el índice de cuentas no se rellenó (D-17 de la
// fase R del plan de créditos; CA-44 de la spec «Registro abierto» de aios-tower). Hasta que corre el relleno,
// los contadores no cuentan las cuentas que ya existían: un «0» o un número a medias se verían como ciertos.
// Dice «sin contar todavía», nombra el comando del relleno y avisa que la lista puede estar incompleta.
import { Icon } from '../../../shared/icons/icon';
import { INDEX_BACKFILL_COMMAND } from '../personal-accounts-labels';
import './uncounted-notice.css';

export function UncountedNotice() {
  return (
    <div className="uncounted-notice">
      <div className="banner" role="note">
        <Icon name="alert" />
        <p>
          <strong>Sin contar todavía.</strong> El índice de cuentas todavía no se rellenó: hasta que se corra{' '}
          <code>{INDEX_BACKFILL_COMMAND}</code> en aios-backend, las pestañas y los orígenes no muestran números, y la
          lista puede estar incompleta, porque le faltan las cuentas que ya existían. La búsqueda por correo sí las encuentra.
        </p>
      </div>
    </div>
  );
}
