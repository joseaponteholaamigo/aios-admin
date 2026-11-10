// Lo que se borra de una cuenta, antes de borrarla (spec «Borrar cuentas y destrabar personas», CA-24):
// qué cuenta es, sus personas y cuánto hay en cada sitio. Lo que se anuncia es lo que se borra.
import type { DeletionPreview } from '../../../domain/account-deletion';
import { badgeClass } from '../../../shared/ui/badge';
import { deletionSiteKeyLabel, deletionSiteLabel } from '../../../shared/labels/deletion-site-labels';
import { seatStatusLabel } from '../../../shared/labels/seat-status-labels';
import { FactList } from '../../../shared/ui/fact-list';
import { planLabel } from '../company-labels';

export function DeletionSummary({ preview }: { preview: DeletionPreview }) {
  const { company, people, sites, packages } = preview;
  const plan = planLabel(company.plan);
  // Lo que tiene filas, y los paquetes siempre: son los archivos con el conocimiento de su negocio.
  const facts = [
    ...sites.filter((s) => s.rows > 0).map(({ site, rows }) => ({ label: deletionSiteLabel(site), value: <span className="mono">{rows}</span> })),
    { label: deletionSiteKeyLabel('packages'), value: <span className="mono">{packages}</span> },
  ];
  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Qué se borra</h2>
          <p>
            <span className="mono">{company.id}</span>
            {company.name && <> · {company.name}</>}
            {company.kind && <> · {company.kind === 'personal' ? 'Cuenta personal' : 'Empresa'}</>}
            {' '}<span className={badgeClass(plan.tone)}>{plan.text}</span>
          </p>
        </div>
      </div>
      <div className="card-b">
        <h3 className="eyebrow">Personas ({people.length})</h3>
        {people.length === 0 ? <p className="empty">La cuenta no tiene personas.</p> : (
          <ul className="chips" aria-label="Personas de la cuenta">
            {people.map((p) => {
              const status = seatStatusLabel(p.status);
              return <li key={p.email} className="chip">{p.email}{p.isAdmin && ' · admin'} · <span className={badgeClass(status.tone)}>{status.text}</span></li>;
            })}
          </ul>
        )}
        <h3 className="eyebrow">En cada sitio</h3>
        <FactList facts={facts} />
      </div>
    </section>
  );
}
