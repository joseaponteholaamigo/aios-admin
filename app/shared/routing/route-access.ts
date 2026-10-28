// Qué acceso exige un pedido y si una persona lo cumple, según la tabla de rutas.
import { matchPath } from 'react-router';
import { can, type TeamMember } from '../../domain/permissions';
import { ROUTE_TABLE, type MenuEntry, type RouteAccess, type RouteEntry } from './route-table';

/** Una entrada del menú de una persona: la ruta, con su nombre, su grupo y su ícono. */
export type MenuItem = { path: string } & MenuEntry;

/** La ruta del documento. En un pedido de datos (`/x.data`, `/_.data`) se quita el sufijo. */
export function requestedPath(url: URL): string {
  const path = url.pathname;
  if (path.endsWith('/_.data')) return path.slice(0, -'_.data'.length) || '/';
  if (path.endsWith('.data')) return path.slice(0, -'.data'.length) || '/';
  return path;
}

/** El acceso que exige `url`, o `null` si la ruta no está en la tabla: eso niega (CA-25). */
export function accessFor(url: URL, table: readonly RouteEntry[] = ROUTE_TABLE): RouteAccess | null {
  const path = requestedPath(url);
  return table.find((r) => matchPath({ path: `/${r.path}`, end: true }, path))?.access ?? null;
}

/** ¿`member` cumple `access`? Una persona inactiva no cumple nada que pida sesión. */
export function allows(member: TeamMember, access: RouteAccess): boolean {
  if (access === 'public') return true;
  if (access === 'member') return member.status === 'active';
  if (access === 'superadmin') return member.status === 'active' && member.isSuperadmin;
  return can(member, access.module, access.level);
}

/** Las entradas del menú que `member` puede abrir: nunca un módulo que no puede usar (CA-25). */
export function menuFor(member: TeamMember, table: readonly RouteEntry[] = ROUTE_TABLE): MenuItem[] {
  return table.flatMap((r) => (r.menu && allows(member, r.access) ? [{ path: `/${r.path}`, ...r.menu }] : []));
}
