// Los lotes congelados de la cuenta en la tarjeta «Servicios de ENSŌ en revisión» (spec «Reanudar la casa de una
// cuenta», CA-12): de quién es, qué lote, cuántos créditos quedan congelados, desde cuándo y el aviso de Stripe, cada
// uno con «Descongelar». Del más viejo al más nuevo, como los manda el backend.
import type { HouseReview } from '../../../domain/house';
import { formatDateTime } from '../../../shared/ui/format';
import { FROZEN_HEADING, FROZEN_LEAD, frozenCreditsText, lotExpiryText, lotName } from '../house-labels';
import { HouseChangeAction } from './house-change-action';
import './frozen-lots-table.css';

type FrozenLotsTableProps = { house: HouseReview; companyId: string; companyTitle: string };

export function FrozenLotsTable({ house, companyId, companyTitle }: FrozenLotsTableProps) {
  return (
    <section className="frozen-lots-table">
      <h3 className="eyebrow accent">{FROZEN_HEADING}</h3>
      <p className="frozen-lots-table__lead">{FROZEN_LEAD}</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Persona</th><th>Lote</th><th className="num">Congelados</th><th>Desde</th><th>Aviso de Stripe</th><th /></tr></thead>
          <tbody>
            {house.frozenLots.map((lot) => {
              const expiry = lotExpiryText(lot);
              return (
                <tr key={`${lot.email}#${lot.lotId}`}>
                  <td className="small">{lot.email}</td>
                  <td className="small">
                    {lotName(lot)}<br />
                    <small className="muted"><span className="mono">{lot.lotId}</span>{expiry && ` · ${expiry}`}</small>
                  </td>
                  <td className="num">{frozenCreditsText(lot)}</td>
                  <td className="small">{formatDateTime(lot.frozenAt)}</td>
                  <td className="small mono">{lot.stripeEvent ?? '—'}</td>
                  <td><HouseChangeAction target={{ action: 'unfreeze', lot }} house={house} companyId={companyId} companyTitle={companyTitle} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
