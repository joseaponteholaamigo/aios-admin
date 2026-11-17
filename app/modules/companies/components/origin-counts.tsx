// Cuántas cuentas personales hay de cada origen, arriba de la lista (spec «Registro abierto» de
// aios-tower, CA-23 y CA-24). Salen de los contadores del índice, así que no cambian con la página;
// con el filtro de empresas visibles puesto, cuentan solo esas cuentas, y lo dice.
import { ACCOUNT_ORIGINS, type OriginCount } from '../../../domain/companies';
import { formatCount } from '../../../shared/ui/format';
import { ONLY_SOME_COUNTS_NOTE, ORIGIN_LABELS } from '../personal-accounts-labels';
import './origin-counts.css';

export function OriginCounts({ counts, onlySome }: { counts: OriginCount; onlySome: boolean }) {
  // Sin ninguna cuenta no hay nada que repartir: lo explica la lista vacía.
  if (counts.total === 0) return null;
  return (
    <div className="origin-counts" role="group" aria-label="Cuentas personales por origen">
      <dl className="origin-counts__list">
        {ACCOUNT_ORIGINS.map((origin) => (
          <div key={origin} className="origin-counts__item">
            <dt>{ORIGIN_LABELS[origin]}</dt>
            <dd>{formatCount(counts.byOrigin[origin])}</dd>
          </div>
        ))}
      </dl>
      {onlySome && <p className="origin-counts__note">{ONLY_SOME_COUNTS_NOTE}</p>}
    </div>
  );
}
