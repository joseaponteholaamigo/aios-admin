// Lo que recibe una empresa, en su ficha: su contenido de base, sus reglas de empresa y cuántas
// skills, agentes y cadenas le llegan. Con los nombres técnicos: el catálogo con etiquetas llega en M2b.
import type { AccessRule, CompanyFile } from '../../../domain/companies';
import { Icon } from '../../../shared/icons/icon';
import { FactList } from '../../../shared/ui/fact-list';
import { CONTENT_LABELS } from '../company-labels';

const ACTIONS: Record<AccessRule['action'], string> = { grant: 'Da', remove: 'Quita', unknown: '—' };

export function CompanyAccessCard({ file }: { file: CompanyFile }) {
  const { access } = file;
  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Lo que recibe</h2>
          <p>Su contenido de base y las reglas de empresa, como las ve su admin en «Mi equipo».</p>
        </div>
      </div>
      <div className="card-b">
        {!access ? (
          <div className="banner"><Icon name="alert" /><p>No se pudo calcular: {file.accessPending ?? 'falta algo publicado'}.</p></div>
        ) : (
          <>
            <FactList facts={[
              { label: 'Contenido de base', value: access.base ? CONTENT_LABELS[access.base] : 'El de su plan' },
              { label: 'Recibe', value: `${access.counts.skills} skills · ${access.counts.agents} agentes · ${access.counts.chains} cadenas` },
            ]} />
            {access.rules.length === 0 ? (
              <p className="empty">Sin reglas de empresa: recibe lo de su contenido de base.</p>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Regla</th><th>Qué hace</th><th>Estado</th></tr></thead>
                  <tbody>
                    {access.rules.map((rule) => (
                      <tr key={rule.key}>
                        <td><code className="mono small">{rule.key}</code></td>
                        <td className="small">{ACTIONS[rule.action]}</td>
                        <td>
                          {rule.missing ? <span className="badge bad">Ya no existe</span>
                            : rule.inactive ? <span className="badge warn">Inactiva: la empresa no lo tiene</span>
                            : <span className="badge ok">Vale</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
