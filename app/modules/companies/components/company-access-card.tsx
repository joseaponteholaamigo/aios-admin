// Lo que recibe una empresa, en su ficha: su contenido de base, sus reglas de empresa y cuántas
// skills, agentes y cadenas le llegan. Con los nombres técnicos: los visibles están en «Reglas de acceso».
// Para quien tiene «editar» en Empresas, enlaza a «Reglas de acceso»; en un plan que no es Personalizado,
// dice por qué no y enlaza a «Cambiar plan» (spec «Reglas de acceso», CA-11).
import { Link } from 'react-router';
import type { CompanyFile } from '../../../domain/companies';
import { Icon } from '../../../shared/icons/icon';
import { badgeClass } from '../../../shared/ui/badge';
import { FactList } from '../../../shared/ui/fact-list';
import { NOT_CUSTOM_REASON, RULE_ACTION_LABELS, ruleStateLabel } from '../access-change-labels';
import { CONTENT_LABELS } from '../company-labels';

type CompanyAccessCardProps = {
  file: CompanyFile;
  /** «Editar» en Empresas: el permiso de «Reglas de acceso» y de «Cambiar plan». */
  canEdit: boolean;
  /** «Cambiar plan» no se ofrece (cobra por Stripe, o está revocada): no se enlaza. */
  planBlocked: boolean;
};

export function CompanyAccessCard({ file, canEdit, planBlocked }: CompanyAccessCardProps) {
  const { access } = file;
  const custom = file.plan === 'custom';
  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Lo que recibe</h2>
          <p>Su contenido de base y las reglas de empresa, como las ve su admin en «Mi equipo».</p>
          {canEdit && !custom && (
            <p>{NOT_CUSTOM_REASON}{!planBlocked && <> <Link to={`/companies/${file.id}/plan`}>Cambiar plan</Link></>}</p>
          )}
        </div>
        {canEdit && custom && <Link className="btn" to={`/companies/${file.id}/access`}>Reglas de acceso</Link>}
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
                    {access.rules.map((rule) => {
                      const state = ruleStateLabel(rule);
                      return (
                        <tr key={rule.key}>
                          <td><code className="mono small">{rule.key}</code></td>
                          <td className="small">{RULE_ACTION_LABELS[rule.action]}</td>
                          <td><span className={badgeClass(state.tone)}>{state.text}</span></td>
                        </tr>
                      );
                    })}
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
