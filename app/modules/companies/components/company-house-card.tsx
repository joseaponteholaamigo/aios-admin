// La tarjeta «Servicios de ENSŌ en revisión» de la ficha (spec «Reanudar la casa de una cuenta», CA-10 a CA-12): solo
// la recibe el superadministrador, y solo aparece si la cuenta está en pausa o tiene lotes congelados. Dice la pausa
// con «Quitar la pausa» y lista los lotes, cada uno con «Descongelar». Si no se pudo leer, lo dice: el resto de la
// ficha se muestra igual.
import { needsReview, type HouseReview } from '../../../domain/house';
import { HOUSE_CARD } from '../house-labels';
import { FrozenLotsTable } from './frozen-lots-table';
import { HousePauseSection } from './house-pause-section';
import './company-house-card.css';

/** La casa de la cuenta, o que no se pudo leer. `null`: quien mira no es superadministrador. */
export type HouseView = { ok: true; house: HouseReview } | { ok: false } | null;

type CompanyHouseCardProps = { view: HouseView; companyId: string; companyTitle: string };

export function CompanyHouseCard({ view, companyId, companyTitle }: CompanyHouseCardProps) {
  if (!view || (view.ok && !needsReview(view.house))) return null;
  return (
    <section className="card company-house-card">
      <div className="card-h">
        <div>
          <h2>{HOUSE_CARD.title}</h2>
          <p>{HOUSE_CARD.lead}</p>
        </div>
      </div>
      <div className="card-b">
        {view.ok ? (
          <>
            <HousePauseSection house={view.house} companyId={companyId} companyTitle={companyTitle} />
            {view.house.frozenLots.length > 0 && <FrozenLotsTable house={view.house} companyId={companyId} companyTitle={companyTitle} />}
          </>
        ) : <p className="empty">{HOUSE_CARD.unreadable}</p>}
      </div>
    </section>
  );
}
