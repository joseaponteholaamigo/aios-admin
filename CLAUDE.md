# CLAUDE.md — aios-admin (panel del superadmin)

El panel con el que el equipo de ENSŌ administra empresas, personas, skills y consumo. Solo entra el equipo. Las reglas que cruzan los proyectos están en el `CLAUDE.md` del workspace; aquí van las de este repo.

## Cómo está armado

- React Router en modo framework, con servidor propio (`server/index.js`, Express) que corre en Lambda detrás de CloudFront.
- No guarda datos del negocio: todo pasa por la API de administración del backend (`/v1/admin/*`). El backend vuelve a revisar los permisos en cada pedido; el panel niega antes para no mostrar lo que no corresponde, nunca en lugar del backend.
- Carpetas:
  - `app/domain/`: reglas sin React ni servidor (los permisos).
  - `app/shared/`: lo que usan dos o más módulos (sesión, login, API, rutas, configuración, menú).
  - `app/modules/<módulo>/`: cada pantalla con sus componentes.
  - `app/middleware/`: lo que corre en cada pedido.
  - `tests/structure.test.ts` hace cumplir qué puede importar cada una.

## Reglas

- **Toda ruta se declara en `app/shared/routing/route-table.ts`, con el acceso que exige.** `app/routes.ts` se arma desde ahí: nunca agregues una ruta directamente en `routes.ts`. Solo las rutas de `auth/` son públicas.
- **Lo que toca tokens, sesiones o la configuración va en archivos `.server.ts`.** Los tokens nunca llegan al navegador.
- **Ningún dato de un pedido vive en una variable del módulo.** Un mismo proceso atiende a varias personas; lo de cada pedido va en el contexto de React Router.
- **Los nombres del backend, en español, se traducen solo en `app/shared/api/`.** El resto del panel usa los nombres en inglés del dominio.
- **Los orígenes públicos nunca se deducen del pedido.** Detrás de CloudFront, el `Host` que llega es el del endpoint de Lambda; los orígenes salen de `PUBLIC_ORIGINS`.
- **La configuración falla al arrancar si falta algo.** Una variable nueva va en `app/shared/config/config.server.ts`, con su mensaje de error, y en `.env.example`. `SESSION_STORE=memory` es solo para desarrollo.
- **Si el backend rechaza a la persona, la sesión se borra y va a «sin acceso», nunca al login.** Con la sesión de Cognito abierta, el login vuelve solo y daría vueltas sin fin.
- **React Router responde el 404 de una ruta que no existe sin correr el middleware.** Lo que tiene que estar en toda página, como las cabeceras de seguridad, se pone también en `app/entry.server.tsx`.
- **`react-router` y los paquetes `@react-router/*` van todos en la misma versión exacta**, sin `^`.

## Comandos

Usa Node 24: corre `nvm use` en la carpeta antes de cualquier comando.

| Para qué | Comando |
|---|---|
| Desarrollo | `cp .env.example .env` la primera vez; después `npm run dev` |
| Pruebas | `npm test` |
| Tipos | `npm run typecheck` |
| Build y servidor como en AWS | `npm run build` y `npm start`, con las variables de `.env.example` en el entorno |

- `/yo` lo responde el backend: en local, `npm run dev` en `aios-backend`, y su dirección va en `ADMIN_API_URL`.
- Antes de commitear corre `npm test`, `npm run typecheck` y `npm run build`. Si algo falla, no commitees.

## Specs

Las specs del panel están en `specs/`. Antes de implementar una fase, lee la suya.
