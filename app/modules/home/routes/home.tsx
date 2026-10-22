// La página de inicio. En M1 muestra quién es la persona y qué módulos puede usar (CA-31).
import { Form } from 'react-router';

export default function Home() {
  return (
    <main>
      <h1>Panel ensō</h1>
      <Form method="post" action="/auth/logout">
        <button type="submit">Cerrar sesión</button>
      </Form>
    </main>
  );
}
