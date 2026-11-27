// La pausa de la casa en la tarjeta «Servicios de ENSŌ en revisión» (spec «Reanudar la casa de una cuenta», CA-11):
// desde cuándo, si fue un reembolso o una disputa de Stripe, el id del aviso y qué significa, con «Quitar la pausa».
// Sin pausa (quedan solo lotes congelados), lo dice.
import type { HouseReview } from '../../../domain/house';
import { NO_PAUSE, PAUSE_MEANING, STRIPE_EVENT_LABEL, pauseStatusText } from '../house-labels';
import { HouseChangeAction } from './house-change-action';
import './house-pause-section.css';

type HousePauseSectionProps = { house: HouseReview; companyId: string; companyTitle: string };

export function HousePauseSection({ house, companyId, companyTitle }: HousePauseSectionProps) {
  const { pause } = house;
  if (!pause) return <p className="house-pause-section__none">{NO_PAUSE}</p>;
  return (
    <div className="house-pause-section">
      <p className="house-pause-section__status">{pauseStatusText(pause)}</p>
      <p>{PAUSE_MEANING}</p>
      <p className="house-pause-section__event">{STRIPE_EVENT_LABEL}: <span className="mono">{pause.stripeEvent ?? '—'}</span></p>
      <div className="house-pause-section__actions">
        <HouseChangeAction target={{ action: 'lift-pause' }} house={house} companyId={companyId} companyTitle={companyTitle} />
      </div>
    </div>
  );
}
