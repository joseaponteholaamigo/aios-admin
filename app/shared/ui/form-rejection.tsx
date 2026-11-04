// Un rechazo del backend que no es de un campo (spec «Crear empresas e invitar personas», CA-19):
// va arriba del formulario. El de MFA trae cómo volver a ingresar el código y regresar aquí.
import { Link, useLocation } from 'react-router';
import type { WriteRejection } from '../../domain/account-creation';
import { Icon } from '../icons/icon';
import { rejectionMessage } from '../labels/write-rejection-labels';

export function FormRejection({ rejection }: { rejection: WriteRejection }) {
  const { pathname, search } = useLocation();
  return (
    <div className="banner" role="alert">
      <Icon name="alert" />
      <p>
        {rejectionMessage(rejection)}{' '}
        {rejection.code === 'recent-mfa' && <Link to={`/auth/login?mfa=1&returnTo=${encodeURIComponent(pathname + search)}`}>Ingresar el código</Link>}
      </p>
    </div>
  );
}
