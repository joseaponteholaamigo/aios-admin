// El menú del panel: solo las rutas que la persona puede abrir (`menuFor`), y la salida.
import { Form, NavLink } from 'react-router';

export type MenuItem = { path: string; label: string };

export function MainNav({ items }: { items: MenuItem[] }) {
  return (
    <nav aria-label="Menú del panel">
      <ul>
        {items.map((item) => (
          <li key={item.path}>
            <NavLink to={item.path} end>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <Form method="post" action="/auth/logout">
        <button type="submit">Cerrar sesión</button>
      </Form>
    </nav>
  );
}
