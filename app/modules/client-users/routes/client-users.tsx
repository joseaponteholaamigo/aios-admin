// Usuarios de clientes: buscar a una persona por su correo (CA-23 de M2a). Por POST, como el
// backend: el correo no queda en la dirección ni en el historial del navegador.
import { Form, Link, useNavigation } from 'react-router';
import { z } from 'zod';
import type { Route } from './+types/client-users';
import { fromAdminApi } from '../../../shared/api/admin-loader.server';
import { FilterNotice } from '../../../shared/layout/filter-notice';
import { ModuleError } from '../../../shared/layout/module-error';
import { PageHeader } from '../../../shared/layout/page-header';
import { SearchField } from '../../../shared/ui/search-field';
import { PersonResult } from '../components/person-result';

/**
 * La misma regla que `correoNormalizado` del backend, y no `z.email()`: esa es más estricta, y soporte
 * no podría buscar justo los correos raros que el backend sí guardó (`josé@acme.com`, `a..b@acme.com`).
 */
const EMAIL_LIKE_BACKEND = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEARCH = z.object({ email: z.string().trim().toLowerCase().regex(EMAIL_LIKE_BACKEND) });

export async function action({ request, context }: Route.ActionArgs) {
  const parsed = SEARCH.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { error: 'Escribe un correo completo, como persona@empresa.com.' as const, result: null };
  const result = await fromAdminApi({ request, context }, (api, token) => api.findPerson(token, parsed.data.email));
  return { error: null, result };
}

export default function ClientUsers({ actionData }: Route.ComponentProps) {
  const searching = useNavigation().state === 'submitting';
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Administración' }, { label: 'Usuarios de clientes' }]}
        title="Usuarios de clientes"
        lead="Busca a una persona por su correo: en qué empresa está, con qué rol y en qué estado."
        actions={<Link className="btn" to="/client-users/checkup">Revisión de datos</Link>}
      />
      {actionData?.result && <FilterNotice onlySome={actionData.result.onlySome} />}
      <section className="card">
        <div className="card-h">
          <Form method="post" className="filtros" role="search">
            <SearchField inputMode="email" name="email" label="Correo de la persona" placeholder="persona@empresa.com" />
            <button type="submit" className="btn sm primary" disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
          </Form>
        </div>
        <div className="card-b">
          {actionData?.error && <p className="badge warn" role="alert">{actionData.error}</p>}
          {actionData?.result ? <PersonResult result={actionData.result} /> : !actionData?.error && <p className="muted small">Escribe el correo completo.</p>}
        </div>
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ModuleError error={error} />;
}

export function meta(): Route.MetaDescriptors {
  return [{ title: 'Usuarios de clientes · Panel ensō' }];
}
