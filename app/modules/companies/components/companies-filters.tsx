// La barra de filtros de Empresas: buscar y elegir un plan, en un solo lugar y con el mismo trato
// que Usuarios de clientes (spec «Cuentas personales», CA-19 y CA-20). Cada cambio se aplica solo; el
// único botón es «Borrar filtros».
//
// Solo muestra y avisa: el texto, el plan y qué pasa al cambiarlos los maneja la pantalla.
import { LIST_PLANS, isListPlan, type AccountKind, type KindCount, type ListPlan } from '../../../domain/companies';
import { SearchInput } from '../../../shared/ui/search-input';
import { planLabel } from '../company-labels';
import './companies-filters.css';

type Props = {
  kind: AccountKind;
  /** Cuántas cuentas de esta pestaña hay de cada plan: solo se ofrecen los que tienen alguna. Sin el dato, todos y sin número. */
  counts: KindCount;
  plan: ListPlan | null;
  text: string;
  onTextChange: (text: string) => void;
  onPlanChange: (plan: ListPlan | null) => void;
  onClearAll: () => void;
};

export function CompaniesFilters({ kind, counts, plan, text, onTextChange, onPlanChange, onClearAll }: Props) {
  const byPlan = counts.plans;
  // El plan elegido se ofrece aunque no tenga cuentas: si no, la lista diría «Todos los planes» con un filtro puesto.
  // Sin el dato de cuántas hay de cada plan se ofrecen todos, sin número: un «(0)» que no es cierto escondería cuentas.
  const plans = byPlan ? LIST_PLANS.filter((p) => byPlan[p] > 0 || p === plan) : LIST_PLANS;
  const optionText = (p: ListPlan) => (byPlan ? `${planLabel(p).text} (${byPlan[p]})` : planLabel(p).text);
  const personal = kind === 'personal';
  return (
    <div className="filtros companies-filters" role="search" aria-label={personal ? 'Filtrar las cuentas personales' : 'Filtrar las empresas'}>
      <SearchInput
        value={text} onChange={onTextChange} inputMode={personal ? 'email' : 'search'}
        label={personal ? 'Buscar por correo' : 'Buscar por nombre o id'} placeholder={personal ? 'Buscar por correo' : 'Buscar por nombre o id'}
      />
      <select
        name="plan" aria-label="Plan" value={plan ?? ''} className={plan ? 'on' : undefined}
        onChange={(e) => onPlanChange(isListPlan(e.target.value) ? e.target.value : null)}
      >
        <option value="">Todos los planes</option>
        {plans.map((p) => <option key={p} value={p}>{optionText(p)}</option>)}
      </select>
      {(text || plan) && <button type="button" className="btn sm soft" onClick={onClearAll}>Borrar filtros</button>}
    </div>
  );
}
