// Los filtros de la bitácora de créditos (CA-30): empresa, persona, módulo, tipo y fechas, solos o
// combinados. Van en el formulario de la pantalla, que se manda por POST: el correo no va en la dirección.
import { Link } from 'react-router';
import { CREDIT_LOG_KINDS, CREDIT_MODULES } from '../../../domain/credits';
import { KIND_LABELS, MODULE_LABELS } from '../../../shared/labels/credit-labels';
import { FieldError } from '../../../shared/ui/field-error';
import { SubmitButton } from '../../../shared/ui/submit-button';
import './credit-log-filters.css';

type Props = { values: Record<string, string>; errors: Record<string, string>; filtered: boolean };

export function CreditLogFilters({ values, errors, filtered }: Props) {
  return (
    <section className="card">
      <div className="card-b credit-log-filters" role="search" aria-label="Filtrar la bitácora de créditos">
        <div className="field">
          <label htmlFor="company">Empresa (id)</label>
          <input id="company" name="company" defaultValue={values.company ?? ''} placeholder="auteco-4d5e6f" />
          <FieldError message={errors.company} />
        </div>
        <div className="field">
          <label htmlFor="email">Persona</label>
          <input id="email" name="email" type="email" inputMode="email" defaultValue={values.email ?? ''} placeholder="nombre@empresa.com" />
          <FieldError message={errors.email} />
        </div>
        <div className="field">
          <label htmlFor="module">Módulo</label>
          <select id="module" name="module" defaultValue={values.module ?? ''}>
            <option value="">Todos</option>
            {CREDIT_MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}
          </select>
          <FieldError message={errors.module} />
        </div>
        <div className="field">
          <label htmlFor="kind">Tipo</label>
          <select id="kind" name="kind" defaultValue={values.kind ?? ''}>
            <option value="">Todos</option>
            {CREDIT_LOG_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
          <FieldError message={errors.kind} />
        </div>
        <div className="field">
          <label htmlFor="from">Desde</label>
          <input id="from" name="from" type="date" defaultValue={values.from ?? ''} />
          <FieldError message={errors.from} />
        </div>
        <div className="field">
          <label htmlFor="to">Hasta</label>
          <input id="to" name="to" type="date" defaultValue={values.to ?? ''} />
          <FieldError message={errors.to} />
        </div>
        <div className="credit-log-filters__actions">
          <SubmitButton label="Filtrar" busyLabel="Filtrando…" />
          {filtered && <Link className="btn ghost" to="/usage">Quitar filtros</Link>}
        </div>
      </div>
    </section>
  );
}
