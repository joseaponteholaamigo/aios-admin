// La tabla de las cuentas personales: la persona de cada una, su plan, su estado, de dónde salió y
// si ya entró (spec «Cuentas personales», CA-21). El origen es el que anotó el backend al crearla
// (CA-23 de «Registro abierto»). No tiene asientos ni admins: es una sola persona. Un clic en
// cualquier parte de la fila abre su ficha.
import { Link } from 'react-router';
import type { Company } from '../../../domain/companies';
import { CompanyBadge } from '../../../shared/ui/company-badge';
import { formatDate } from '../../../shared/ui/format';
import { LinkedRow } from '../../../shared/ui/linked-row';
import { badgeClass, expiryLabel, planLabel, statusLabel } from '../company-labels';
import { originLabel } from '../personal-accounts-labels';

const fileOf = (account: Company) => `/companies/${account.id}`;

export function PersonalAccountsTable({ accounts, emptyMessage }: { accounts: Company[]; emptyMessage: string }) {
  if (accounts.length === 0) return <p className="empty">{emptyMessage}</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Persona</th><th>Plan</th><th>Estado</th><th>Vence</th><th>Origen</th><th>Entró</th><th /></tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const [plan, status, expiry] = [planLabel(account.plan), statusLabel(account), expiryLabel(account)];
            return (
              <LinkedRow key={account.id} to={fileOf(account)}>
                <td><CompanyBadge id={account.id} name={account.person?.email ?? 'Sin persona'} to={fileOf(account)} /></td>
                <td><span className={badgeClass(plan.tone)}>{plan.text}</span></td>
                <td><span className={badgeClass(status.tone)}>{status.text}</span></td>
                <td className="small">{expiry ? <span className={badgeClass(expiry.tone)}>{expiry.text}</span> : formatDate(account.expiry.until)}</td>
                <td><span className="chip">{originLabel(account.origin)}</span></td>
                <td className="small">{account.person?.acceptedAt ? formatDate(account.person.acceptedAt) : 'Todavía no'}</td>
                <td><Link className="btn sm soft" to={fileOf(account)} aria-label={`Abrir la cuenta de ${account.person?.email ?? account.id}`}>Abrir</Link></td>
              </LinkedRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
