// Las condiciones de un Personalizado en el formulario de crear (spec «Crear empresas e invitar
// personas», CA-17): contenido, asientos, equipo, horarios, fecha de fin y cupos. En una cuenta
// personal, los asientos y el equipo no se eligen: es de una persona.
import type { AccountKind } from '../../../domain/companies';
import { QUOTA_RESOURCES, type PlanConditions } from '../../../domain/account-creation';
import { FieldError } from '../../../shared/ui/field-error';
import { quotaField, type FormValues } from '../new-account-form-data';
import './plan-conditions-fields.css';

const QUOTA_LABELS = { radar: 'Radar', projects: 'Proyectos', skills: 'Skills', chains: 'Cadenas' } as const;

type Props = {
  kind: AccountKind;
  /** Lo que viene lleno: lo escrito antes de un rechazo, o el caso más común. */
  values: FormValues | null;
  defaults: PlanConditions;
  errors: Record<string, string>;
  hidden: boolean;
};

/** El valor de un campo: lo escrito, o el de por defecto si el formulario se abre por primera vez. */
const pick = (values: FormValues | null, field: string, fallback: string) => (values ? values[field] ?? '' : fallback);
const picked = (values: FormValues | null, field: string, fallback: boolean) => (values ? values[field] === 'on' : fallback);

export function PlanConditionsFields({ kind, values, defaults, errors, hidden }: Props) {
  const personal = kind === 'personal';
  return (
    <div className="plan-conditions" hidden={hidden}>
      <div className="grid g3">
        <div className="field">
          <label htmlFor="content">Contenido</label>
          <select id="content" name="content" defaultValue={pick(values, 'content', defaults.content)}>
            <option value="all">Todo el contenido</option>
            <option value="free">El de Free</option>
            <option value="none">Nada: solo lo que se le dé después</option>
          </select>
          <FieldError message={errors.content} />
        </div>
        <div className="field">
          <label htmlFor="seats">Asientos</label>
          {personal
            ? <p className="plan-conditions__fixed">1 · es de una persona</p>
            // `required` solo a la vista: oculto (plan Free), el navegador frenaría el envío sin decir por qué.
            : <input id="seats" name="seats" type="number" min={1} step={1} required={!hidden} defaultValue={pick(values, 'seats', String(defaults.seats))} />}
          <FieldError message={errors.seats} />
        </div>
        <div className="field">
          <label htmlFor="endsOn">Fecha de fin</label>
          <input id="endsOn" name="endsOn" type="date" defaultValue={pick(values, 'endsOn', defaults.endsOn ?? '')} />
          <small>Vacía: sin fecha de fin.</small>
          <FieldError message={errors.endsOn} />
        </div>
      </div>
      <div className="plan-conditions__checks">
        {personal
          ? <p className="small muted">Sin equipo compartido: es de una persona.</p>
          : <label className="plan-conditions__check"><input type="checkbox" name="team" defaultChecked={picked(values, 'team', defaults.team)} /> Equipo compartido</label>}
        <label className="plan-conditions__check"><input type="checkbox" name="schedules" defaultChecked={picked(values, 'schedules', defaults.schedules)} /> Horarios</label>
      </div>
      <fieldset className="plan-conditions__quotas">
        <legend>Cupos <span className="small muted">· vacío: sin tope</span></legend>
        <div className="grid g4">
          {QUOTA_RESOURCES.map((resource) => (
            <div className="field" key={resource}>
              <label htmlFor={quotaField(resource)}>{QUOTA_LABELS[resource]}</label>
              <input id={quotaField(resource)} name={quotaField(resource)} type="number" min={0} step={1} placeholder="sin tope" defaultValue={pick(values, quotaField(resource), '')} />
              <FieldError message={errors[quotaField(resource)]} />
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
