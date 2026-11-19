// Qué acceso exige un pedido y si una persona lo cumple, según la tabla de rutas.
import { matchPath } from 'react-router';
import { MODULES, can, type Module, type TeamMember } from '../../domain/permissions';
import { ROUTE_TABLE, type MenuEntry, type MenuGroup, type RouteAccess, type RouteEntry } from './route-table';

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

/**
 * Los módulos que tienen al menos una pantalla, en el orden de `MODULES`. Lo usa el editor de
 * permisos de «Equipo ensō»: un módulo sin pantalla no se ofrece, porque darlo no abriría nada (spec
 * «Equipo ENSŌ», decisión 3). Sale de la tabla de rutas: cuando una pantalla nueva sale, su módulo
 * aparece solo.
 */
export function modulesWithScreen(table: readonly RouteEntry[] = ROUTE_TABLE): Module[] {
  const withRoute = new Set(table.flatMap((r) => (typeof r.access === 'object' ? [r.access.module] : [])));
  return MODULES.filter((m) => withRoute.has(m));
}

/** El grupo del menú donde aparece la pantalla principal de un módulo (para agrupar el editor como el menú). */
export function menuGroupOf(module: Module, table: readonly RouteEntry[] = ROUTE_TABLE): MenuGroup {
  const entry = table.find((r) => r.menu && typeof r.access === 'object' && r.access.module === module);
  return entry?.menu?.group ?? 'administration';
}
