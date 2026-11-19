// El plan de una cuenta en su ficha: lo que tiene hoy, calculado como el manifest que recibe ENSŌ,
// y las condiciones de su Personalizado si lo es. Una cuenta personal no muestra la parte de equipo:
// es una sola persona.
import type { CompanyFile, CustomConditions } from '../../../domain/companies';
import { FactList, type Fact } from '../../../shared/ui/fact-list';
import { formatDate } from '../../../shared/ui/format';
import { CONTENT_LABELS, quotasLabel } from '../company-labels';

const yesNo = (value: boolean | null) => (value === true ? 'Sí' : value === false ? 'No' : '—');

function planFacts(file: CompanyFile): Fact[] {
  const p = file.effectivePlan;
  if (!p) return [];
  const team: Fact[] = file.kind === 'personal' ? [] : [
    { label: 'Asientos', value: `${file.seats.used} usados de ${p.seats ?? '—'}` },
    { label: 'Maneja equipo', value: yesNo(p.managesSeats) },
  ];
  return [
    { label: 'Tier', value: p.tier ?? '—' },
    { label: 'Contenido (preset)', value: p.preset ?? '—' },
    ...team,
    { label: 'Trabajo compartido', value: yesNo(p.flags.collaboration) },
    { label: 'Horarios', value: yesNo(p.flags.scheduling) },
    { label: 'Cupos', value: quotasLabel(p.quotas) },
  ];
}

const conditionFacts = (c: CustomConditions): Fact[] => [
  { label: 'Asientos acordados', value: c.seats ?? '—' },
  { label: 'Contenido de base', value: c.content ? CONTENT_LABELS[c.content] : '—' },
  { label: 'Equipo', value: yesNo(c.team) },
  { label: 'Horarios', value: yesNo(c.scheduling) },
  { label: 'Hasta', value: formatDate(c.until) },
  { label: 'Cupos propios', value: quotasLabel(c.quotas) },
];

export function CompanyPlanCard({ file }: { file: CompanyFile }) {
  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Plan</h2>
          <p>Lo que tiene hoy, calculado igual que el plan que recibe su ENSŌ.</p>
        </div>
      </div>
      <div className="card-b">
        {file.effectivePlan
          ? <FactList facts={planFacts(file)} />
          : <p className="empty">No se pudo calcular su plan: la ficha de esta empresa tiene datos que el backend no entiende.</p>}
        {file.conditions && (
          <>
            <h3 className="eyebrow accent">Condiciones del Personalizado</h3>
            <FactList facts={conditionFacts(file.conditions)} />
          </>
        )}
      </div>
    </section>
  );
}
