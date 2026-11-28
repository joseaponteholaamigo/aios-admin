// La lista de «Claves de la casa» (spec «Compartir referentes» de aios-tower, D18): una fila por servicio,
// con si su clave está puesta y en qué termina, cuándo cambió, su saldo y si está encendido. Por ahora una
// sola fila, ScrapeCreators. Un clic en la fila, o «Administrar», abre su página.
import { Link } from 'react-router';
import type { HouseKeyStatus } from '../../../domain/house-keys';
import { badgeClass } from '../../../shared/ui/badge';
import { formatDate } from '../../../shared/ui/format';
import { LinkedRow } from '../../../shared/ui/linked-row';
import { SERVICE_INFO, balanceLabel, enabledLabel, houseKeyHref, keyStateLabel } from '../house-keys-labels';

export function HouseKeysTable({ services }: { services: HouseKeyStatus[] }) {
  if (services.length === 0) return <p className="empty">El backend no administra ninguna clave de la casa todavía.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Servicio</th><th>Qué hace en ENSŌ</th><th>Clave</th><th>Cambió</th><th className="num">Saldo</th><th>Para todos</th><th /></tr>
        </thead>
        <tbody>
          {services.map((status) => {
            const { name, purpose } = SERVICE_INFO[status.service];
            const keyState = keyStateLabel(status);
            const enabled = enabledLabel(status.enabled);
            return (
              <LinkedRow key={status.service} to={houseKeyHref(status.service)}>
                <td><b>{name}</b></td>
                <td className="small">{purpose}</td>
                <td><span className={badgeClass(keyState.tone)}>{keyState.text}</span></td>
                <td className="small mono">{formatDate(status.lastChange.changedAt)}</td>
                <td className="num">{balanceLabel(status.balance)}</td>
                <td><span className={badgeClass(enabled.tone)}>{enabled.text}</span></td>
                <td><Link className="btn sm soft" to={houseKeyHref(status.service)} aria-label={`Administrar ${name}`}>Administrar</Link></td>
              </LinkedRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
