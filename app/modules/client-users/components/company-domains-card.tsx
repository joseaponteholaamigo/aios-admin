// Lo que tiene la empresa para repartir, por dominio, con los nombres técnicos de las skills (el
// catálogo con etiquetas llega en M2b). Cada dominio se abre sin JavaScript (`<details>`).
import type { CompanyPeople } from '../../../domain/client-users';
import { countsLabel } from '../client-user-labels';

export function CompanyDomainsCard({ domains, counts }: Pick<CompanyPeople, 'domains' | 'counts'>) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Lo que tiene la empresa</h2><p>{countsLabel(counts)}, para repartir entre sus roles y personas.</p></div></div>
      <div className="card-b">
        {domains.length === 0 ? <p className="empty">La empresa no recibe skills.</p> : domains.map((domain) => (
          <details key={domain.slug}>
            <summary><b>{domain.slug}</b> <span className="muted small">· {domain.skills.length} skills</span></summary>
            <ul className="chips" aria-label={`Skills de ${domain.slug}`}>
              {domain.skills.map((skill) => <li key={skill} className="chip">{skill}</li>)}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
