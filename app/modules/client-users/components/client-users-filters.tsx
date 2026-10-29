// La barra de filtros de Usuarios de clientes, como la del panel viejo: buscar a una persona por su
// correo y filtrar la lista por empresa, en un solo lugar.
//
// ⛔ Son dos formularios aparte a propósito. El del correo va por POST y es el único que lo lleva:
// así el correo nunca termina en la URL. El de la empresa va por GET, para que la lista filtrada se
// pueda recargar y compartir, y nunca lleva el cursor: filtrar vuelve a la primera página.
import { Form, Link } from 'react-router';
import type { CompanyOption } from '../../../domain/client-users';
import { SearchField } from '../../../shared/ui/search-field';
import './client-users-filters.css';

export const EMAIL_ERROR_ID = 'client-users-email-error';

type Props = { companies: CompanyOption[]; company: string; searching: boolean; emailError: string | null };

export function ClientUsersFilters({ companies, company, searching, emailError }: Props) {
  const withTeam = companies.filter((c) => c.hasTeam);
  const solo = companies.filter((c) => !c.hasTeam);
  const unknown = company !== '' && !companies.some((c) => c.id === company);
  return (
    <div className="client-users-filters">
      <Form method="post" className="filtros" role="search" aria-label="Buscar una persona por correo">
        <SearchField
          inputMode="email" name="email" label="Correo exacto de la persona" placeholder="Correo exacto de la persona"
          errorId={emailError ? EMAIL_ERROR_ID : undefined}
        />
        <button type="submit" className="btn sm primary">{searching ? 'Buscando…' : 'Buscar'}</button>
      </Form>
      <span className="client-users-filters__divider" aria-hidden="true" />
      <Form method="get" className="filtros" role="search" aria-label="Filtrar la lista">
        {/* `key`: al quitar el filtro, la lista vuelve a «Todas las empresas». */}
        <select key={company} name="company" aria-label="Empresa" defaultValue={company} className={company ? 'on' : undefined}>
          <option value="">Todas las empresas</option>
          {unknown && <option value={company}>{company}</option>}
          {withTeam.length > 0 && (
            <optgroup label={`Empresas con equipo (${withTeam.length})`}>
              {withTeam.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          )}
          {solo.length > 0 && (
            <optgroup label={`Empresas de un solo asiento (${solo.length})`}>
              {solo.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          )}
        </select>
        <button type="submit" className="btn sm">Filtrar</button>
        {company && <Link className="btn sm soft" to="?">Quitar filtro</Link>}
      </Form>
      {emailError && <p id={EMAIL_ERROR_ID} className="badge warn client-users-filters__error" role="alert">{emailError}</p>}
    </div>
  );
}
