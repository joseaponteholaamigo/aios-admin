// El mapa de rutas de React Router, armado desde la tabla de rutas (`shared/routing/route-table.ts`),
// que dice además qué acceso exige cada una. Una ruta nueva se agrega allá, nunca aquí.
import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { ROUTE_TABLE } from './shared/routing/route-table';

export default ROUTE_TABLE.map((r) => (r.path === '' ? index(r.file) : route(r.path, r.file))) satisfies RouteConfig;
