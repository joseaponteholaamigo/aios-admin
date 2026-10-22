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
  /** El nombre en el menú. Sin él, la ruta no aparece en el menú. */
  menuLabel?: string;
};

export const ROUTE_TABLE: readonly RouteEntry[] = [
  { path: '', file: 'modules/home/routes/home.tsx', access: 'member', menuLabel: 'Inicio' },
  { path: 'auth/login', file: 'modules/auth/routes/login.tsx', access: 'public' },
  { path: 'auth/callback', file: 'modules/auth/routes/callback.tsx', access: 'public' },
  { path: 'auth/logout', file: 'modules/auth/routes/logout.tsx', access: 'public' },
  { path: 'auth/no-access', file: 'modules/auth/routes/no-access.tsx', access: 'public' },
];
