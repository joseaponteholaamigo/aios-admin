// Por qué el backend no vio o no guardó un cambio de acceso (spec «Reglas de acceso», CA-14): un cambio que
// no se puede aplicar, con cada motivo; las reglas que cambiaron mientras tanto, que piden volver a verlo;
// o cualquier otro rechazo, con su texto general.
import type { WriteRejection } from '../../../domain/account-creation';
import { Icon } from '../../../shared/icons/icon';
import { rejectionMessage } from '../../../shared/labels/write-rejection-labels';
import { FormRejection } from '../../../shared/ui/form-rejection';
import { CONFLICT_MESSAGE } from '../access-change-labels';
import { sentence } from '../plan-change-labels';

export function AccessChangeRejection({ rejection }: { rejection: WriteRejection }) {
  if (rejection.code !== 'access-rejected') {
    return <FormRejection rejection={rejection} message={rejection.code === 'conflict' ? CONFLICT_MESSAGE : undefined} />;
  }
  return (
    <div className="banner" role="alert">
      <Icon name="alert" />
      <div>
        <p>{rejectionMessage(rejection)}</p>
        <ul>{rejection.rejections.map((text) => <li key={text}>{sentence(text)}</li>)}</ul>
      </div>
    </div>
  );
}
