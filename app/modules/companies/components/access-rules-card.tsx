// Las reglas de empresa que tiene hoy, en «Reglas de acceso» (spec «Reglas de acceso», CA-12): su base,
// cuánto recibe y cada regla con su estado y su nombre visible. En un Personalizado, cada regla tiene
// «Volver a la base»: pide la vista previa de borrarla, que se guarda como cualquier otro cambio.
import { Form } from 'react-router';
import type { CompanyAccessRules } from '../../../domain/access-rules';
import { targetToken } from '../../../domain/access-rules';
import { badgeClass } from '../../../shared/ui/badge';
import { FactList } from '../../../shared/ui/fact-list';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { RESET_FIELD } from '../access-change-form-data';
import { RULE_ACTION_LABELS, TARGET_KIND_LABELS, ruleStateLabel, type NameLookup } from '../access-change-labels';
import { CONTENT_LABELS } from '../company-labels';
import './access-rules-card.css';

type AccessRulesCardProps = {
  access: CompanyAccessRules;
  names: NameLookup;
  /** Con «Volver a la base» en cada regla: solo en un Personalizado. */
  editable: boolean;
};

export function AccessRulesCard({ access, names, editable }: AccessRulesCardProps) {
  const { receives } = access;
  return (
    <section className="card">
      <div className="card-h"><div><h2>Sus reglas de empresa</h2>
        <p>Lo que se le da o se le quita encima de su contenido de base. «Volver a la base» borra la regla; las de sus roles y personas son de su admin y no se tocan.</p></div></div>
      <div className="card-b">
        <FactList facts={[
          { label: 'Contenido de base', value: access.base ? CONTENT_LABELS[access.base] : 'El de su plan' },
          { label: 'Recibe', value: `${receives.skills} skills · ${receives.agents} agentes · ${receives.chains} cadenas` },
        ]} />
        {access.rules.length === 0 ? (
          <p className="empty">Sin reglas de empresa: recibe lo de su contenido de base.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Regla</th><th>Qué hace</th><th>Estado</th>{editable && <th>Acción</th>}</tr></thead>
              <tbody>
                {access.rules.map((rule) => {
                  const token = targetToken(rule.target);
                  const state = ruleStateLabel(rule);
                  return (
                    <tr key={token}>
                      <td>
                        <span className="access-rules__name">{TARGET_KIND_LABELS[rule.target.kind]} · {names(rule.target) ?? rule.target.name}</span>
                        <code className="mono small">{rule.target.name}</code>
                      </td>
                      <td className="small">{RULE_ACTION_LABELS[rule.action]}</td>
                      <td><span className={badgeClass(state.tone)}>{state.text}</span></td>
                      {editable && (
                        <td className="access-rules__reset">
                          <Form method="post">
                            <SubmitButton name={RESET_FIELD} value={token} label="Volver a la base" busyLabel="Calculando…" className="btn sm" />
                          </Form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
