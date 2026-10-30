// La tabla de empresas, con las columnas del panel viejo que tienen datos en M2a: plan, estado,
// vencimiento, asientos, admins y cómo paga.
import { Link } from 'react-router';
import type { Company } from '../../../domain/companies';
import { CompanyBadge } from '../../../shared/ui/company-badge';
import { formatDate } from '../../../shared/ui/format';
import { badgeClass, expiryLabel, planLabel, statusLabel } from '../company-labels';

const fileOf = (company: Company) => `/companies/${company.id}`;

/** `emptyMessage`: qué decir sin ninguna, que depende del plan elegido y de la página (`emptyAccountsMessage`). */
export function CompaniesTable({ companies, emptyMessage }: { companies: Company[]; emptyMessage: string }) {
  if (companies.length === 0) return <p className="empty">{emptyMessage}</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Empresa</th><th>Plan</th><th>Estado</th><th>Vence</th><th className="num">Asientos</th><th className="num">Admins</th><th>Pago</th><th />
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const [plan, status, expiry] = [planLabel(company.plan), statusLabel(company), expiryLabel(company)];
            return (
              <tr key={company.id}>
                <td><CompanyBadge id={company.id} name={company.name} to={fileOf(company)} /></td>
                <td><span className={badgeClass(plan.tone)}>{plan.text}</span></td>
                <td><span className={badgeClass(status.tone)}>{status.text}</span></td>
                <td className="small">{expiry ? <span className={badgeClass(expiry.tone)}>{expiry.text}</span> : formatDate(company.expiry.until)}</td>
                <td className="num">{company.seats.used} / {company.seats.cap ?? '—'}</td>
                <td className="num">{company.admins === 0 ? <span className="badge warn">Sin admin</span> : company.admins}</td>
                <td><span className="chip">{company.paysWithStripe ? 'Stripe' : 'Directo'}</span></td>
                <td><Link className="btn sm soft" to={fileOf(company)}>Abrir</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
