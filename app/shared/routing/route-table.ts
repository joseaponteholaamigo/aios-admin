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

/** El nombre visible de cada grupo del menú (la barra lateral, y el editor de permisos de «Equipo ensō»). */
export const MENU_GROUP_LABELS: Record<MenuGroup, string> = { administration: 'Administración', business: 'Negocio' };

/** Cómo aparece una ruta en el menú: su nombre, su grupo y su ícono. */
export type MenuEntry = { label: string; group: MenuGroup; icon: IconName };

export type RouteAccess =
  /** Sin sesión. Solo el login y la página de «sin acceso» (CA-25). */
  | 'public'
  /** Cualquier persona activa del equipo (la página de inicio). */
  | 'member'
  /** Solo el superadministrador: «Equipo ensō» no es un módulo que se asigne. */
  | 'superadmin'
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
  // El menú sigue el orden de la barra lateral del panel viejo.
  { path: '', file: 'modules/home/routes/home.tsx', access: 'member', menu: { label: 'Inicio', group: 'administration', icon: 'fleet' } },
  {
    path: 'companies', file: 'modules/companies/routes/companies.tsx', access: { module: 'companies', level: 'view' },
    menu: { label: 'Empresas', group: 'administration', icon: 'empresas' },
  },
  // Antes que `:companyId`: la tabla se lee en orden, y `new` no es una empresa.
  { path: 'companies/new', file: 'modules/companies/routes/company-new.tsx', access: { module: 'companies', level: 'edit' } },
  { path: 'companies/:companyId', file: 'modules/companies/routes/company.tsx', access: { module: 'companies', level: 'view' } },
  // Cambiar el plan y las características de una cuenta (spec «Editar cuentas y personas», CA-27 y CA-28): reemplaza a
  // «Cambiar asientos», con el mismo permiso.
  { path: 'companies/:companyId/plan', file: 'modules/companies/routes/company-plan.tsx', access: { module: 'companies', level: 'edit' } },
  // Dar o quitar dominios y skills a un Personalizado (spec «Reglas de acceso», decisión 1): el mismo permiso que
  // «Cambiar plan». Ver las reglas ya está en la ficha, con «ver».
  { path: 'companies/:companyId/access', file: 'modules/companies/routes/company-access.tsx', access: { module: 'companies', level: 'edit' } },
  // Borrar una cuenta: solo el superadministrador (CA-23). Tener «editar» en Empresas no alcanza.
  { path: 'companies/:companyId/delete', file: 'modules/companies/routes/company-delete.tsx', access: 'superadmin' },
  // Revocar o reactivar una cuenta desde los diálogos de su ficha (spec «Revocar y reactivar una cuenta», decisión 1):
  // solo el superadministrador. Solo responde a un POST.
  { path: 'companies/:companyId/status', file: 'modules/companies/routes/company-status.tsx', access: 'superadmin' },
  // Quitar la pausa de la casa de una cuenta o descongelar un lote, desde la tarjeta de su ficha (spec «Reanudar la
  // casa de una cuenta», decisión 2): solo el superadministrador. Solo responde a un POST, con el correo en el cuerpo.
  { path: 'companies/:companyId/house', file: 'modules/companies/routes/company-house.tsx', access: 'superadmin' },
  {
    path: 'client-users', file: 'modules/client-users/routes/client-users.tsx', access: { module: 'clientUsers', level: 'view' },
    menu: { label: 'Usuarios de clientes', group: 'administration', icon: 'usuarios' },
  },
  // Antes que `:companyId`: la tabla se lee en orden, y `checkup` no es una empresa.
  { path: 'client-users/checkup', file: 'modules/client-users/routes/checkup.tsx', access: { module: 'clientUsers', level: 'view' } },
  { path: 'client-users/:companyId', file: 'modules/client-users/routes/company-people.tsx', access: { module: 'clientUsers', level: 'view' } },
  { path: 'client-users/:companyId/invite', file: 'modules/client-users/routes/invite-person.tsx', access: { module: 'clientUsers', level: 'edit' } },
  // El diálogo de «Créditos» de una persona (spec «Créditos por persona» de aios-tower): su saldo es de
  // Consumo; cargarle créditos, de Empresas. Las dos solo responden a un POST, con el correo en el cuerpo.
  { path: 'client-users/:companyId/credits', file: 'modules/client-users/routes/person-credits.tsx', access: { module: 'usage', level: 'view' } },
  { path: 'client-users/:companyId/credits/load', file: 'modules/client-users/routes/person-credits-load.tsx', access: { module: 'companies', level: 'edit' } },
  // El diálogo «Analítica y términos» de una persona (spec «Analítica de una persona», decisión 1): ver pide «ver» en
  // Usuarios; su `action` vuelve a pedir «editar» para dejar de compartir o volver a compartir. Solo responde a un POST.
  { path: 'client-users/:companyId/analytics', file: 'modules/client-users/routes/person-analytics.tsx', access: { module: 'clientUsers', level: 'view' } },
  { path: 'team', file: 'modules/team/routes/team.tsx', access: 'superadmin', menu: { label: 'Equipo ensō', group: 'administration', icon: 'people' } },
  // Dar de alta, ver y administrar a una persona del equipo (spec «Equipo ENSŌ»): solo el superadministrador.
  { path: 'team/new', file: 'modules/team/routes/team-new.tsx', access: 'superadmin' },
  { path: 'team/:sub', file: 'modules/team/routes/team-member.tsx', access: 'superadmin' },
  {
    // La bitácora de créditos (spec «Créditos por persona» de aios-tower, CA-27 a CA-32).
    path: 'usage', file: 'modules/usage/routes/usage.tsx', access: { module: 'usage', level: 'view' },
    menu: { label: 'Consumo', group: 'business', icon: 'consumo' },
  },
  {
    path: 'governance', file: 'modules/governance/routes/governance.tsx', access: { module: 'governance', level: 'view' },
    menu: { label: 'Gobernanza', group: 'business', icon: 'gobernanza' },
  },
  {
    // Los códigos de registro (spec «Códigos de registro», CA-4 a CA-6).
    path: 'codes', file: 'modules/codes/routes/codes.tsx', access: { module: 'codes', level: 'view' },
    menu: { label: 'Códigos', group: 'business', icon: 'codigos' },
  },
  // Antes que `:code`: la tabla se lee en orden, y `new` no es un código.
  { path: 'codes/new', file: 'modules/codes/routes/code-new.tsx', access: { module: 'codes', level: 'edit' } },
  // Ver pide «ver»; las acciones de su `action` (pausar, reanudar, revocar) las vuelve a revisar el backend con «editar».
  { path: 'codes/:code', file: 'modules/codes/routes/code.tsx', access: { module: 'codes', level: 'view' } },
  {
    // El tope de la voz (spec «Registro abierto» de aios-tower, CA-33): solo el superadministrador, como su
    // ruta en el backend. No es un módulo que se asigne.
    path: 'voice', file: 'modules/voice/routes/voice.tsx', access: 'superadmin',
    menu: { label: 'Tope de la voz', group: 'business', icon: 'voz' },
  },
  {
    // Las claves de la casa (spec «Compartir referentes» de aios-tower, D14 a D21): la lista de servicios y la
    // página de cada uno. Solo el superadministrador, como su ruta en el backend (D15); no es un módulo que se asigne.
    path: 'house-keys', file: 'modules/house-keys/routes/house-keys.tsx', access: 'superadmin',
    menu: { label: 'Claves de la casa', group: 'business', icon: 'key' },
  },
  { path: 'house-keys/:service', file: 'modules/house-keys/routes/house-key.tsx', access: 'superadmin' },
  { path: 'auth/login', file: 'modules/auth/routes/login.tsx', access: 'public' },
  { path: 'auth/callback', file: 'modules/auth/routes/callback.tsx', access: 'public' },
  { path: 'auth/logout', file: 'modules/auth/routes/logout.tsx', access: 'public' },
  { path: 'auth/no-access', file: 'modules/auth/routes/no-access.tsx', access: 'public' },
];
