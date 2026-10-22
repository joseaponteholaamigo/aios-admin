// El mapa de rutas del panel. Cada módulo aporta sus rutas desde `app/modules/<módulo>/routes/`;
// las pantallas que juntan varios módulos (la ficha de una empresa) se componen solo aquí.
import { type RouteConfig, index } from '@react-router/dev/routes';

export default [
  index('modules/home/routes/home.tsx'),
] satisfies RouteConfig;
