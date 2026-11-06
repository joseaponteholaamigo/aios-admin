# Spec: El superadmin en su propio stack

- **Fecha:** 2026-11-06
- **Origen:** el stack del backend llegó a 490 recursos después de mezclar la fase 2 de seguridad (`31a98cd`), y CloudFormation acepta 500. El borrado de cuentas y las acciones sobre personas no caben.
  - Jose, 2026-11-06: «El deber ser es B. Debería pasarse todo lo del superadmin a un stack aparte […] eso no se ha entregado a nadie, solo el backend de ENSŌ está en estado productivo».
  - Jose, 2026-11-06, sobre crear de nuevo el pool y la tabla del equipo: «Sí, vamos trabajando en el nuevo stack».
- **Estado:** borrador
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`, rama `superadmin_v2`) y `aios-admin` (solo se vuelve a desplegar).
- **Desbloquea:** `specs/2026-11-04-spec-borrar-cuentas-y-destrabar-personas.md`.

## Objetivo

El backend de ENSŌ, que usan los clientes, y el superadmin, que todavía no usa nadie, se despliegan cada uno en su stack de CloudFormation. Desplegar uno no toca el otro. El backend vuelve a tener margen bajo el límite de 500 recursos, y el superadmin tiene espacio para crecer.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Un stack independiente, `AiosAdmin`**, en el mismo repo y la misma app de CDK, con su propia entrada (`infra/app-admin.js`) y sus propios comandos (`npm run infra:diff:admin`, `npm run infra:deploy:admin`). Desplegar el backend no sintetiza el stack de admin, y al revés. No es un stack anidado: uno anidado se despliega junto con el backend y no los separa. | Jose, 2026-11-06 (opción B) |
| 2 | **Se muda todo lo que es solo del superadmin:** el pool de Cognito del equipo con su cliente, su dominio, su estilo y su servidor de recursos; la tabla `equipo`; la API de admin con su autorizador, su etapa y su registro de accesos; las funciones `Admin*` con sus rutas; la alarma de errores de la API de admin; y los parámetros de SSM que lee el panel. | Jose, 2026-11-06 |
| 3 | **Se queda en el backend lo que usan los clientes:** `tenants`, `teampublishes`, `eventos` (la auditoría, que también escriben los webhooks y ENSŌ), los buckets `bundles` y `teambundles`, el pool de clientes, la identidad de correo y el canal de invitaciones, y el tema de alarmas. | Jose, 2026-11-06 |
| 4 | **El stack de admin usa lo del backend por nombre, nunca por exports de CloudFormation.** Las tablas, los buckets, el canal de invitaciones y el tema de alarmas tienen nombre fijo. El id del pool de clientes, que no lo tiene, lo publica el backend en SSM (`/aios/usuarios/pool-id`). Con exports, el backend no podría cambiar un valor que el otro stack importa, y un stack frenaría el despliegue del otro. Es lo mismo que ya hace el panel. | Propuesta técnica |
| 5 | **El pool y la tabla del equipo se crean nuevos**, sin mudar sus datos. Hoy solo tienen la cuenta de Jose: se le vuelve a dar de alta con `npm run equipo`, con contraseña temporal y QR nuevo. | Jose, 2026-11-06 |
| 6 | **Lo que lleva un nombre único usa nombres nuevos `aios-admin-*`:** la tabla `aios-admin-equipo`, el dominio del login `aios-admin-<cuenta>` y las funciones `aios-admin-<nombre>`. Así no chocan con lo viejo, que queda huérfano. Los parámetros de SSM conservan sus nombres (`/aios/equipo/pool-id`, `/aios/equipo/cliente-id`, `/aios/equipo/login-url`, `/aios/admin/api-url`), así que el panel no cambia de configuración. | Propuesta técnica |
| 7 | **Lo viejo queda huérfano y se borra a mano después de probar el stack nuevo:** el pool `aios-equipo` con su dominio y la tabla `aios-equipo`. Lo protege `RETAIN`, así que salir del stack no lo borra. Mientras tanto es el respaldo. Borrarlo es una acción anunciada que corre Jose. | Propuesta |
| 8 | **La auditoría que ya hizo el panel se queda en `eventos` con el actor viejo** (`equipo:<sub del pool viejo>`). Gobernanza la muestra con un actor que ya no está en el equipo. | Consecuencia de la decisión 5, aceptada por Jose el 2026-11-06 |
| 9 | **Cada stack tiene su política de stack:** la del backend deja de nombrar lo del equipo, y la de admin (`infra/stack-policy-admin.json`) protege el pool, su cliente, su dominio, la tabla y la API. `scripts/check-stack-policy.mjs` recibe el nombre del stack, y los dos `infra:deploy` lo corren antes de desplegar. | Propuesta técnica |
| 10 | **Los fallos no controlados del stack de admin se cuentan en la misma métrica** (`aios/Backend`, `FalloNoControlado`), así que la alarma del backend los sigue viendo. La alarma de errores de la API de admin avisa al tema `aios-alarmas`, por su nombre. | Propuesta técnica |

## Antes de empezar

- **Hecho:** `superadmin_v2` trae `branch-qa` completa (`31a98cd`, 2026-11-06).
- **Pregunta abierta:** si la fase 2 de seguridad se despliega primero sola, con el superadmin todavía dentro del backend, o junto con la mudanza. Ver «Riesgos».

## Orden de construcción

1. Sacar de `infra/aios-stack.js` la fábrica de funciones (`crear`, el grupo de logs de cada función y el filtro de fallos) a `infra/funciones.js`, para que la usen los dos stacks.
2. Crear `infra/admin-stack.js` (`AiosAdminStack`) y `infra/app-admin.js`, con `montarEquipo` (`infra/equipo.js`) y lo del backend leído por nombre.
3. Quitar el equipo de `AiosBackendStack` y publicar `/aios/usuarios/pool-id`. El backend deja de pedir `AIOS_ADMIN_URLS` y `AIOS_ADMIN_CLIENTES`, y el stack de admin pasa a exigirlas.
4. Las dos políticas de stack y el chequeo con el nombre del stack.
5. Los comandos de `package.json` (`infra:diff:admin`, `infra:deploy:admin`, `infra:synth:admin`), con `--app "node infra/app-admin.js"` y su propia carpeta de salida (`cdk.out.admin`), para que un despliegue no pise la plantilla del otro.
6. Los documentos: `docs/INFRAESTRUCTURA.md` y `docs/COMANDOS-SUPERADMIN.md`.

## Alcance

- **Backend (`aios-backend`):** la infraestructura de CDK, los comandos, las políticas de stack, sus tests y los documentos de infraestructura. El código de las funciones (`src/`) no cambia.
- **Panel (`aios-admin`):** ningún cambio de código. Se vuelve a desplegar después del stack nuevo, porque su permiso `DescribeUserPoolClient` se ata al id del pool al desplegar.

## Fuera de alcance

- Mudar los datos del pool o de la tabla del equipo (decisión 5).
- Borrar lo viejo que queda huérfano: es un paso manual posterior (decisión 7).
- Mover el panel al repo del backend, o el stack de admin al repo del panel.
- El borrado de cuentas y las acciones sobre personas: van en su propia spec, encima de esta.

## Criterios de aceptación

### CA-1: El backend no tiene nada del equipo
- **Dado** la plantilla sintetizada de `AiosBackendStack`
- **Entonces** no tiene otro pool de Cognito que el de clientes, ni la tabla `equipo`, ni la API de admin, ni funciones `aios-admin*`, ni rutas `/v1/admin/*`
- **Y** sintetiza sin `AIOS_ADMIN_URLS` ni `AIOS_ADMIN_CLIENTES`.

### CA-2: El backend publica el id del pool de clientes
- **Dado** la misma plantilla
- **Entonces** tiene el parámetro `/aios/usuarios/pool-id` con el id del pool `Usuarios`.

### CA-3: El stack de admin tiene todo el superadmin
- **Dado** la plantilla sintetizada de `AiosAdminStack`
- **Entonces** tiene:
  - el pool del equipo: segundo factor obligatorio, sin registro propio, `RETAIN` y protección contra borrado;
  - su cliente del panel, con `ALLOW_USER_AUTH`, y el dominio `aios-admin-<cuenta>`;
  - la tabla `aios-admin-equipo`, con `RETAIN`, protección contra borrado y recuperación a un punto en el tiempo;
  - la API de admin, con autorizador JWT del pool del equipo y scope `admin/acceso`, y su registro de accesos;
  - una ruta por cada entrada de `RUTAS_ADMIN` (`src/lambda.js`), y ninguna más.

### CA-4: Los permisos siguen siendo los justos
- **Dado** la plantilla del stack de admin
- **Entonces** cada función tiene los mismos permisos que hoy, sobre los recursos del backend nombrados: las de lectura solo leen; las que escriben solo agregan a `eventos` (`PutItem`); el correo sale solo como `noreply@emails.beenso.com`
- **Y** ninguna recibe las variables del pool de clientes (`COGNITO_ISSUER`, `COGNITO_CLIENTE_ID`).

### CA-5: Ningún stack depende del otro por exports
- **Dado** las dos plantillas
- **Entonces** ninguna tiene `Outputs` con `Export` que use la otra, ni `Fn::ImportValue`.

### CA-6: El panel encuentra todo con los mismos nombres
- **Dado** la plantilla del stack de admin
- **Entonces** escribe `/aios/equipo/pool-id`, `/aios/equipo/cliente-id`, `/aios/equipo/login-url` y `/aios/admin/api-url`, los nombres de `BACKEND_PARAMETERS` (`aios-admin/infra/names.ts`).

### CA-7: Las alarmas siguen viendo al superadmin
- **Dado** la plantilla del stack de admin
- **Entonces** cada grupo de logs de sus funciones tiene el filtro de fallos con la métrica `aios/Backend` · `FalloNoControlado`
- **Y** la alarma de errores 5xx de su API avisa al tema `aios-alarmas`.

### CA-8: Cada stack con su política, y el chequeo antes de desplegar
- **Dado** `infra/stack-policy.json` e `infra/stack-policy-admin.json`
- **Entonces** cada una nombra solo recursos de su stack, y todo recurso con `RETAIN` de cada stack está en la suya
- **Y** `npm run infra:deploy` y `npm run infra:deploy:admin` corren `check-stack-policy` con su stack antes de `cdk deploy`.

### CA-9: Los dos stacks tienen margen
- **Dado** las dos plantillas
- **Entonces** cada una tiene 450 recursos o menos: 50 de margen bajo el límite de CloudFormation.

### CA-10: En producción el panel funciona con el stack nuevo
- **Dado** los pasos de «Despliegue» hechos
- **Cuando** Jose entra al panel con su alta nueva
- **Entonces** le pide contraseña y código, ve Empresas, Usuarios de clientes, Gobernanza y Equipo ensō
- **Y** puede crear una empresa de prueba e invitar a una persona, y la empresa se borra después con `npm run eliminar-usuarios`.

## Casos borde y de error

### CB-1: Desplegar el backend desde una rama que todavía tiene el equipo adentro
- **Dado** el stack de admin ya desplegado, y alguien despliega el backend desde una rama sin esta spec (hoy `branch-qa`)
- **Entonces** el despliegue falla al crear un parámetro de SSM que ya existe, y CloudFormation deshace lo que alcanzó a crear
- **Y** por eso esta spec llega a `branch-qa` justo después de desplegarse, y se avisa a Omar antes.

### CB-2: Desplegar el stack de admin antes de sacar el equipo del backend
- **Entonces** el stack de admin no se crea: sus parámetros de SSM ya existen, y CloudFormation lo deshace entero. Lo que sí está en el backend no cambia.

### CB-3: Desplegar el panel antes que el stack de admin
- **Entonces** el despliegue del panel falla porque no existe `/aios/equipo/pool-id`, y el panel que estaba sigue igual.

### CB-4: La política vieja sigue aplicada al desplegar el backend
- **Entonces** `check-stack-policy` frena el despliegue antes de `cdk deploy`, porque la del repo ya no nombra lo del equipo. Sin el chequeo, la política vieja haría fallar el despliegue a mitad, al quitar recursos que protege.

## Despliegue (lo corre Jose, con aviso antes de cada paso)

1. Aplicar la política nueva del backend (`set-stack-policy` con `infra/stack-policy.json`) y comprobarla con `check-stack-policy`.
2. `npm run infra:diff` en el backend: tiene que mostrar como `[-]` todo lo del equipo y nada de los clientes, y como `[+]` el parámetro del pool de clientes (más la fase 2 de seguridad, si no se desplegó antes). Después, `npm run infra:deploy`. **Desde aquí el panel deja de funcionar.**
3. `npm run infra:diff:admin`: todo `[+]`. Después, `npm run infra:deploy:admin`.
4. Aplicar la política del stack de admin y comprobarla.
5. Dar de alta a Jose en el pool nuevo, como superadministrador (`npm run equipo`, con `EQUIPO_POOL_ID` del pool nuevo).
6. Volver a desplegar el panel (`npm run infra:deploy` en `aios-admin`).
7. Probar CA-10.
8. Más adelante, borrar lo huérfano (decisión 7).

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-2, CA-9 (backend) | síntesis de la plantilla | `tests/infra-stack.test.js` |
| CA-3, CA-4, CA-6, CA-7, CA-9 (admin) | síntesis de la plantilla | `tests/infra-equipo.test.js`, que sintetiza `AiosAdminStack` |
| CA-5 | síntesis de las dos plantillas | `tests/infra-equipo.test.js` |
| CA-8 | unit de la comparación y lectura de los dos archivos | `tests/check-stack-policy.test.js` |
| CA-10 | manual | Jose, en producción, después del paso 6 |

## Archivos probablemente afectados

**Backend (`aios-backend-superadmin`)**
- `infra/funciones.js` (nuevo): la fábrica de funciones, sus grupos de logs y el filtro de fallos.
- `infra/admin-stack.js` (nuevo): `AiosAdminStack`.
- `infra/app-admin.js` (nuevo): la entrada de CDK del stack de admin, con la misma baranda de cuenta (`exigirCuentaPermitida`).
- `infra/equipo.js`: los nombres `aios-admin-*` y lo del backend leído por nombre.
- `infra/aios-stack.js`: sin el equipo, con `/aios/usuarios/pool-id`.
- `infra/app.js`: sin las variables del panel.
- `infra/stack-policy.json` e `infra/stack-policy-admin.json` (nuevo).
- `scripts/check-stack-policy.mjs`: el nombre del stack por argumento.
- `package.json`: los comandos del stack de admin.
- `tests/infra-stack.test.js`, `tests/infra-equipo.test.js` y `tests/check-stack-policy.test.js`.
- `docs/INFRAESTRUCTURA.md` y `docs/COMANDOS-SUPERADMIN.md`.

**Panel (`aios-admin`):** sin cambios de código.

## Riesgos y preguntas abiertas

- **La fase 2 de seguridad todavía no está desplegada.** Si va en el mismo despliegue que la mudanza, un problema de cualquiera de las dos frena las dos. Recomendación: desplegar primero `superadmin_v2` tal como está hoy (con la fase 2 y el superadmin todavía en el backend), con su política nueva aplicada, y la mudanza en un segundo despliegue. Lo decide Jose, idealmente con Omar.
- **Coordinación con Omar (CB-1):** después de la mudanza, nadie despliega el backend desde una rama que todavía tenga el equipo. Esta spec llega a `branch-qa` con el PR de `superadmin_v2`.
- **El panel queda caído entre los pasos 2 y 6.** Hoy solo lo usa Jose.
- **Lo huérfano tiene protección contra borrado** (el pool, desde la fase 2): para borrarlo a mano, primero se le quita la protección.
