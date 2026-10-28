// Una empresa como la mostraba el panel viejo: su logo de iniciales, su nombre y su id.
import { Link } from 'react-router';
import { colorIndexOf, initialsOf } from './format';
import './company-badge.css';

export function CompanyBadge({ id, name, to }: { id: string; name: string; to?: string }) {
  const content = (
    <>
      <span className={`logo logo--c${colorIndexOf(id)}`} aria-hidden="true">{initialsOf(name)}</span>
      <span>
        <b>{name}</b>
        <small>{id}</small>
      </span>
    </>
  );
  return to ? <Link className="ent" to={to}>{content}</Link> : <span className="ent">{content}</span>;
}
