// Las pestañas de Empresas: las empresas y las cuentas personales, cada una con cuántas hay
// (spec «Cuentas personales», CA-18). Cada una es un enlace: la pestaña viaja en la dirección.
import { Link } from 'react-router';
import type { AccountKind } from '../../../domain/companies';
import { formatCount } from '../../../shared/ui/format';
import './company-tabs.css';

/**
 * Cuántas cuentas hay de cada tipo. En la pestaña de Empresas salen de su lista; en la de cuentas
 * personales, de los contadores del índice (CA-24 de «Registro abierto»): las dos tienen un total.
 */
type TabCounts = Record<'companies' | 'personal', { total: number }>;

const TABS: { kind: AccountKind; label: string; to: string; count: (c: TabCounts) => number }[] = [
  { kind: 'company', label: 'Empresas', to: '/companies', count: (c) => c.companies.total },
  { kind: 'personal', label: 'Cuentas personales', to: '/companies?kind=personal', count: (c) => c.personal.total },
];

export function CompanyTabs({ kind, counts }: { kind: AccountKind; counts: TabCounts }) {
  return (
    <nav className="company-tabs" aria-label="Tipo de cuenta">
      {TABS.map((tab) => (
        <Link key={tab.kind} to={tab.to} className={tab.kind === kind ? 'on' : undefined} aria-current={tab.kind === kind ? 'page' : undefined}>
          {`${tab.label} (${formatCount(tab.count(counts))})`}
        </Link>
      ))}
    </nav>
  );
}
