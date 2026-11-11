// Lo que es un código (spec «Códigos de registro», CA-4): qué da, cuándo sirve y cuánto lleva.
import type { RegistrationCode } from '../../../domain/codes';
import { FactList } from '../../../shared/ui/fact-list';
import { formatDateTime } from '../../../shared/ui/format';
import { creditsLabel, durationLabel, usesLabel } from '../code-labels';

export function CodeFacts({ code }: { code: RegistrationCode }) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Qué da</h2><p>A cada persona que lo usa: su cuenta personal en Pro.</p></div></div>
      <div className="card-b">
        <FactList facts={[
          { label: 'Plan', value: `Pro ${durationLabel(code.duration)}` },
          { label: 'Créditos', value: creditsLabel(code.monthlyCredits) },
          { label: 'Válido desde', value: formatDateTime(code.from) },
          { label: 'Válido hasta', value: formatDateTime(code.until) },
          { label: 'Usos', value: usesLabel(code) },
          { label: 'Reservas vigentes', value: String(code.liveReservations) },
          { label: 'Freno del día', value: `${code.dailyBrake} reservas` },
          { label: 'Creado', value: formatDateTime(code.createdAt) },
        ]} />
      </div>
    </section>
  );
}
