// La tabla de rutas del panel: cada ruta, su archivo y el acceso que exige.
//
// ── UNA SOLA FUENTE ────────────────────────────────────────────────────────────────────────
// `app/routes.ts` arma el mapa de React Router desde aquí, y los middleware de acceso y de
// permisos leen de aquí qué exige cada pedido. Una ruta no puede existir sin declarar su acceso:
// el tipo lo exige, y `tests/routes-declare-permission.test.ts` falla si aparece un archivo de
// ruta que no está en la tabla, o una ruta pública fuera de `auth/`.
//
// Es solo datos: lo lee también el build (`routes.ts`), así que no importa nada que corra.
import type { Level, Module } from '../../domain/permissions';
import type { IconName } from '../icons/icon-paths';

/** Los grupos del menú, en el orden de la barra lateral del panel viejo. */
export const MENU_GROUPS = ['administration', 'business'] as const;
export type MenuGroup = (typeof MENU_GROUPS)[number];

/** Cómo aparece una ruta en el menú: su nombre, su grupo y su ícono. */
export type MenuEntry = { label: string; group: MenuGroup; icon: IconName };

export type RouteAccess =
  /** Sin sesión. Solo el login y la página de «sin acceso» (CA-25). */
  | 'public'
  /** Cualquier persona activa del equipo (la página de inicio). */
  | 'member'
  | { module: Module; level: Level };

export type RouteEntry = {
  /** La ruta, sin barra inicial (`auth/login`); `''` es la página de inicio. */
  path: string;
  /** El archivo, relativo a `app/`. */
  file: string;
  access: RouteAccess;
  /** Su entrada en el menú. Sin ella, la ruta no aparece en el menú. */
  menu?: MenuEntry;
};

export const ROUTE_TABLE: readonly RouteEntry[] = [
  { path: '', file: 'modules/home/routes/home.tsx', access: 'member', menu: { label: 'Inicio', group: 'administration', icon: 'fleet' } },
  { path: 'auth/login', file: 'modules/auth/routes/login.tsx', access: 'public' },
  { path: 'auth/callback', file: 'modules/auth/routes/callback.tsx', access: 'public' },
  { path: 'auth/logout', file: 'modules/auth/routes/logout.tsx', access: 'public' },
  { path: 'auth/no-access', file: 'modules/auth/routes/no-access.tsx', access: 'public' },
];
