// Una empresa como la mostraba el panel viejo: su logo de iniciales, su nombre y su id. En tamaño
// `sm`, para las tablas donde la empresa es un dato más de la fila (Usuarios de clientes): logo chico
// y una sola línea, así la fila tiene la misma altura que la de una cuenta personal; el id queda en
// el `title`.
import { Link } from 'react-router';
import { colorIndexOf, initialsOf } from './format';
import './company-badge.css';

type CompanyBadgeProps = { id: string; name: string; to?: string; size?: 'md' | 'sm' };

export function CompanyBadge({ id, name, to, size = 'md' }: CompanyBadgeProps) {
  const small = size === 'sm';
  const className = small ? 'ent ent--sm' : 'ent';
  const content = (
    <>
      <span className={`logo logo--c${colorIndexOf(id)}`} aria-hidden="true">{initialsOf(name)}</span>
      {small ? <b>{name}</b> : <span><b>{name}</b><small>{id}</small></span>}
    </>
  );
  const title = small ? id : undefined;
  return to
    ? <Link className={className} to={to} title={title}>{content}</Link>
    : <span className={className} title={title}>{content}</span>;
}
