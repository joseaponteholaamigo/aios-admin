// Cerrar sesión, desde la barra superior. Solo por POST: pasa por la protección CSRF (CA-22 de M1).
import { Form } from 'react-router';
import { Icon } from '../icons/icon';

export function SignOutButton() {
  return (
    <Form method="post" action="/auth/logout">
      <button type="submit" className="adm-iconbtn tip-abajo tip-izq" aria-label="Cerrar sesión" data-tip="Cerrar sesión">
        <Icon name="logout" />
      </button>
    </Form>
  );
}
