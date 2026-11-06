# Spec: El superadmin en su propio stack

- **Fecha:** 2026-11-06
- **Origen:** el stack del backend llegó a 490 recursos después de mezclar la fase 2 de seguridad (`31a98cd`), y CloudFormation acepta 500. El borrado de cuentas y las acciones sobre personas no caben.
  - Jose, 2026-11-06: «El deber ser es B. Debería pasarse todo lo del superadmin a un stack aparte […] eso no se ha entregado a nadie, solo el backend de ENSŌ está en estado productivo».
  - Jose, 2026-11-06, sobre crear de nuevo el pool y la tabla del equipo: «Sí, vamos trabajando en el nuevo stack».
- **Estado:** construida en `aios-backend`, sin desplegar. Falta el despliegue (abajo) y probar CA-10.
- **Repos:** `aios-backend` (rama `superadmin_v2`) y `aios-admin` (solo se vuelve a desplegar).
- **Desbloquea:** `specs/2026-11-04-spec-borrar-cuentas-y-destrabar-personas.md`.

## Objetivo

El backend de ENSŌ, que usan los clientes, y el superadmin, que todavía no usa nadie, se despliegan cada uno en su stack de CloudFormation. Desplegar uno no toca el otro. El backend vuelve a tener margen bajo el límite de 500 recursos, y el superadmin tiene espacio para crecer.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Un stack independiente, `AiosAdministrator`**, en el mismo repo y la misma app de CDK, con su propia entrada (`infra/app-administrator.js`, que monta `infra/administrator-stack.js`) y sus propios comandos (`npm run infra:diff:admin`, `npm run infra:deploy:admin`). Desplegar el backend no sintetiza el stack del superadmin, y al revés. No es un stack anidado: uno anidado se despliega junto con el backend y no los separa. **No se llama `AiosAdmin`**: ese es el stack del panel (`aios-admin/infra/app.ts`), y con el mismo nombre un despliegue pisaría al otro. | Jose, 2026-11-06 (opción B; el nombre, «AiosAdministrator queda mejor») |
| 2 | **Se muda todo lo que es solo del superadmin:** el pool de Cognito del equipo con su cliente, su dominio, su estilo y su servidor de recursos; la tabla `equipo`; la API de admin con su autorizador, su etapa y su registro de accesos; las funciones `Admin*` con sus rutas; la alarma de errores de la API de admin; y los parámetros de SSM que lee el panel. | Jose, 2026-11-06 |
| 3 | **Se queda en el backend lo que es del producto:** `tenants`, `teampublishes`, `eventos` (la auditoría), los buckets `bundles` y `teambundles`, el pool de clientes, la identidad de correo y el canal de invitaciones, y el tema de alarmas. | Jose, 2026-11-06 |
| 4 | **El stack del superadmin usa lo del backend por nombre, nunca por exports de CloudFormation.** Las tablas, los buckets, el canal de invitaciones y el tema de alarmas tienen nombre fijo. El id del pool de clientes, que no lo tiene, lo publica el backend en SSM (`/aios/usuarios/pool-id`). Con exports, el backend no podría cambiar un valor que el otro stack importa, y un stack frenaría el despliegue del otro. Es lo mismo que ya hace el panel. | Propuesta técnica |
| 5 | **El pool y la tabla del equipo se crean nuevos**, sin mudar sus datos. Hoy solo tienen la cuenta de Jose: se le vuelve a dar de alta con `npm run equipo`, con contraseña temporal y QR nuevo. | Jose, 2026-11-06 |
| 6 | **Lo suyo usa nombres nuevos `aios-admin-*`:** el pool `aios-admin-equipo`, la tabla `aios-admin-equipo` y el dominio del login `aios-admin-<cuenta>`. Así no chocan con lo viejo, que queda huérfano. Las funciones conservan sus nombres (`aios-adminYo`, `aios-adminClientes`…): el despliegue del backend las borra antes de que el stack nuevo las cree. Los parámetros de SSM también (`/aios/equipo/pool-id`, `/aios/equipo/cliente-id`, `/aios/equipo/login-url`, `/aios/admin/api-url`), así que el panel no cambia de configuración. | Propuesta técnica |
| 7 | **Lo viejo queda huérfano y se borra a mano después de probar el stack nuevo:** el pool `aios-equipo` y la tabla `aios-equipo`. Los protege `RETAIN`, así que salir del stack no los borra. Mientras tanto son el respaldo. Borrarlos es una acción anunciada que corre Jose. El cliente del panel, el dominio `aios-equipo-<cuenta>`, la API y las funciones viejas no llevan `RETAIN`: el despliegue del backend los borra. | Propuesta |
| 8 | **La auditoría que ya hizo el panel se queda en `eventos` con el actor viejo** (`equipo:<sub del pool viejo>`). Gobernanza la muestra con un actor que ya no está en el equipo. | Consecuencia de la decisión 5, aceptada por Jose el 2026-11-06 |
| 9 | **Cada stack tiene su política de stack:** la del backend deja de nombrar lo del equipo, y la del superadmin (`infra/stack-policy-administrator.json`) protege el pool, la tabla, el cliente del panel, su dominio y la API. `scripts/check-stack-policy.mjs` recibe el stack (`--stack`), y los dos `infra:deploy` lo corren antes de desplegar. Un stack que no existe solo pasa el chequeo con `AIOS_STACK_NUEVO=<stack>`: sin esa marca, un perfil o una región equivocados levantarían un stack entero en otro lado. | Propuesta técnica |
| 10 | **Los fallos no controlados del stack del superadmin se cuentan en la misma métrica** (`aios/Backend`, `FalloNoControlado`), así que la alarma del backend los sigue viendo. La alarma de errores de la API de admin avisa al tema `aios-alarmas`, por su nombre. | Propuesta técnica |
| 11 | **La tabla del equipo se nombra entera, fuera del prefijo.** El código arma cada nombre con `TABLA_PREFIJO` y pediría `aios-equipo`, la vieja. Las funciones del superadmin reciben `TABLA_EQUIPO=aios-admin-equipo`, y el motor de DynamoDB la usa en lugar del prefijo para esa tabla (`TABLAS_CON_NOMBRE_PROPIO` en `src/lib/storage.js`, `nombreDeTabla` en `src/lib/tabla-dynamo.js`). `npm run equipo` también la necesita, y en producción se niega a seguir sin ella. | Propuesta técnica, al construir |

## Antes de empezar

- **Hecho:** `superadmin_v2` trae `branch-qa` completa (`31a98cd`, 2026-11-06).
- **Decidido:** la fase 2 de seguridad se despliega primero sola, desde `31a98cd`, con el superadmin todavía dentro del backend. La mudanza va en un segundo despliegue.

## Orden de construcción (hecho)

1. La fábrica de funciones (`crear`, el grupo de logs de cada función y el filtro de fallos) sale de `infra/aios-stack.js` a `infra/funciones.js`, y el correo de invitación a `infra/correo.js`, para que los usen los dos stacks.
2. `infra/administrator-stack.js` (`AiosAdministratorStack`) e `infra/app-administrator.js`, con `montarEquipo` (`infra/equipo.js`) y lo del backend leído por nombre.
3. El equipo sale de `AiosBackendStack`, que publica `/aios/usuarios/pool-id`. El backend deja de pedir `AIOS_ADMIN_URLS` y `AIOS_ADMIN_CLIENTES`, y el stack del superadmin pasa a exigirlas.
4. Las dos políticas de stack y el chequeo con el nombre del stack.
5. Los comandos de `package.json` (`infra:diff:admin`, `infra:deploy:admin`, `infra:synth:admin`), con `--app "node infra/app-administrator.js"` y su propia carpeta de salida (`cdk.out.admin`), para que un despliegue no pise la plantilla del otro.
6. Los documentos: `docs/INFRAESTRUCTURA.md` y `docs/COMANDOS-SUPERADMIN.md`.

Comprobado al sintetizar: la plantilla del backend pierde exactamente los 127 recursos del superadmin y gana el parámetro del pool de clientes, sin cambiar ningún otro (490 → 364). El stack del superadmin tiene esos 127, y los permisos de sus 14 funciones son los de antes salvo el nombre de la tabla del equipo.

## Alcance

- **Backend (`aios-backend`):** la infraestructura de CDK, los comandos, las políticas de stack, sus tests y los documentos de infraestructura. Del código (`src/`) cambia solo cómo se resuelve el nombre de la tabla del equipo (decisión 11); `scripts/equipo.mjs` exige `TABLA_EQUIPO` en producción.
- **Panel (`aios-admin`):** ningún cambio de código. Se vuelve a desplegar después del stack nuevo, porque su permiso `DescribeUserPoolClient` se ata al id del pool al desplegar.

## Fuera de alcance

- Mudar los datos del pool o de la tabla del equipo (decisión 5).
- Borrar lo viejo que queda huérfano: es un paso manual posterior (decisión 7).
- Mover el panel al repo del backend, o el stack del superadmin al repo del panel.
- El borrado de cuentas y las acciones sobre personas: van en su propia spec, encima de esta.

## Criterios de aceptación

### CA-1: El backend no tiene nada del equipo
- **Dado** la plantilla sintetizada de `AiosBackendStack`
- **Entonces** no tiene otro pool de Cognito que el de clientes, ni la tabla `equipo`, ni la API de admin, ni funciones `aios-admin*`, ni rutas `/v1/admin/*`, ni parámetros `/aios/equipo/*` o `/aios/admin/*`
- **Y** sintetiza sin `AIOS_ADMIN_URLS` ni `AIOS_ADMIN_CLIENTES`.

### CA-2: El backend publica el id del pool de clientes
- **Dado** la misma plantilla
- **Entonces** tiene el parámetro `/aios/usuarios/pool-id` con el id del pool `Usuarios`.

### CA-3: El stack del superadmin tiene todo el superadmin
- **Dado** la plantilla sintetizada de `AiosAdministratorStack`
- **Entonces** tiene:
  - el pool `aios-admin-equipo`: segundo factor obligatorio, sin registro propio, `RETAIN` y protección contra borrado;
  - su cliente del panel, con `ALLOW_USER_AUTH`, y el dominio `aios-admin-<cuenta>`;
  - la tabla `aios-admin-equipo`, con `RETAIN`, protección contra borrado y recuperación a un punto en el tiempo;
  - la API de admin, con autorizador JWT del pool del equipo y scope `admin/acceso`, y su registro de accesos;
  - una ruta por cada entrada de `RUTAS_ADMIN` (`src/lambda.js`), y ninguna más.

### CA-4: Los permisos siguen siendo los justos
- **Dado** la plantilla del stack del superadmin
- **Entonces** cada función tiene los mismos permisos que hoy, sobre los recursos del backend nombrados: las de lectura solo leen; las que escriben solo agregan a `eventos` (`PutItem`); el correo sale solo como `noreply@emails.beenso.com`
- **Y** ninguna recibe las variables del pool de clientes (`COGNITO_ISSUER`, `COGNITO_CLIENTE_ID`).

### CA-5: Ningún stack depende del otro por exports
- **Dado** las dos plantillas
- **Entonces** ninguna tiene `Outputs` con `Export`, ni `Fn::ImportValue`.

### CA-6: El panel encuentra todo con los mismos nombres
- **Dado** la plantilla del stack del superadmin
- **Entonces** escribe `/aios/equipo/pool-id`, `/aios/equipo/cliente-id`, `/aios/equipo/login-url` y `/aios/admin/api-url`, los nombres de `BACKEND_PARAMETERS` (`aios-admin/infra/names.ts`).

### CA-7: Las alarmas siguen viendo al superadmin
- **Dado** la plantilla del stack del superadmin
- **Entonces** cada grupo de logs de sus funciones tiene el filtro de fallos con la métrica `aios/Backend` · `FalloNoControlado`
- **Y** la alarma de errores 5xx de su API avisa al tema `aios-alarmas`.

### CA-8: Cada stack con su política, y el chequeo antes de desplegar
- **Dado** `infra/stack-policy.json` e `infra/stack-policy-administrator.json`
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
- **Dado** el stack del superadmin ya desplegado, y alguien despliega el backend desde una rama sin esta spec (hoy `branch-qa`)
- **Entonces** el despliegue falla al crear un parámetro de SSM que ya existe, y CloudFormation deshace lo que alcanzó a crear
- **Y** por eso esta spec llega a `branch-qa` justo después de desplegarse, y se avisa a Omar antes.

### CB-2: Desplegar el stack del superadmin antes de sacar el equipo del backend
- **Entonces** el stack del superadmin no se crea: sus parámetros de SSM y sus funciones ya existen con esos nombres, y CloudFormation lo deshace entero. Lo que sí está en el backend no cambia.

### CB-3: Desplegar el panel antes que el stack del superadmin
- **Entonces** el despliegue del panel falla porque no existe `/aios/equipo/pool-id`, y el panel que estaba sigue igual.

### CB-4: La política vieja sigue aplicada al desplegar el backend
- **Entonces** `check-stack-policy` frena el despliegue antes de `cdk deploy`, porque la del repo ya no nombra lo del equipo. Sin el chequeo, la política vieja haría fallar el despliegue a mitad, al quitar recursos que protege.

### CB-5: El primer despliegue del stack del superadmin
- **Dado** que `AiosAdministrator` todavía no existe
- **Cuando** se corre `npm run infra:deploy:admin` sin `AIOS_STACK_NUEVO=AiosAdministrator`
- **Entonces** el chequeo dice que el stack no existe y no despliega
- **Y** con la marca, despliega y recuerda aplicarle su política al terminar.

### CB-6: Una sesión del panel abierta con el pool viejo
- **Dado** que Jose tenía el panel abierto antes de la mudanza
- **Cuando** vuelve después del paso 6
- **Entonces** el backend rechaza su token (es de otro pool), el panel borra la sesión y muestra «sin acceso»; vuelve a entrar con su alta nueva.

## Despliegue (lo corre Jose, con aviso antes de cada paso)

Desde `aios-backend` en `superadmin_v2`, con `AWS_PROFILE=enso` y `AWS_REGION=us-east-2` exportadas y las variables de siempre del backend.

1. Aplicar la política nueva del backend y comprobarla:
   `aws cloudformation set-stack-policy --stack-name AiosBackend --stack-policy-body file://infra/stack-policy.json`
   `node scripts/check-stack-policy.mjs`
2. `npm run infra:diff`: tiene que mostrar como `[-]` todo lo del equipo (127 recursos) y nada de los clientes, y como `[+]` solo `ParametroPoolDeUsuarios` (más el código nuevo de cada función). Después, `npm run infra:deploy`. **Desde aquí el panel deja de funcionar.**
3. `AIOS_ADMIN_URLS=<url del panel> AIOS_ADMIN_CLIENTES=todos npm run infra:diff:admin`: todo `[+]`. Después, el mismo comando con `AIOS_STACK_NUEVO=AiosAdministrator` delante y `infra:deploy:admin`. Anotar sus salidas `PoolDelEquipo` y `TablaDelEquipo`.
4. Aplicar la política del stack del superadmin y comprobarla:
   `aws cloudformation set-stack-policy --stack-name AiosAdministrator --stack-policy-body file://infra/stack-policy-administrator.json`
   `node scripts/check-stack-policy.mjs --stack AiosAdministrator`
5. Dar de alta a Jose en el pool nuevo, como superadministrador: `npm run equipo -- alta … --superadmin`, con `EQUIPO_POOL_ID` y `TABLA_EQUIPO` de las salidas del paso 3.
6. Volver a desplegar el panel (`npm run infra:deploy` en `aios-admin`).
7. Probar CA-10.
8. Más adelante, borrar lo huérfano (decisión 7).

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-2, CA-9 (backend) | síntesis de la plantilla | `tests/infra-stack.test.js` |
| CA-3, CA-4, CA-6, CA-7, CA-9 (superadmin) | síntesis de la plantilla | `tests/infra-equipo.test.js`, que sintetiza `AiosAdministratorStack` |
| CA-5 | síntesis de las dos plantillas | `tests/infra-equipo.test.js` |
| CA-8, CB-5 | unit de la comparación y lectura de los dos archivos | `tests/check-stack-policy.test.js` |
| Decisión 11 | el motor con un cliente falso; los nombres que pide el código contra los que crea cada stack | `tests/tabla-dynamo-transaccion.test.js`, `tests/nombres-desplegados.test.js` |
| CA-10, CB-6 | manual | Jose, en producción, después del paso 6 |

## Archivos afectados

**Backend (`aios-backend`)**
- `infra/funciones.js` (nuevo): la fábrica de funciones, sus grupos de logs y el filtro de fallos.
- `infra/correo.js` (nuevo): el remitente, el canal de invitaciones y su permiso.
- `infra/administrator-stack.js` (nuevo): `AiosAdministratorStack`.
- `infra/app-administrator.js` (nuevo): la entrada de CDK del stack del superadmin, con la misma baranda de cuenta (`exigirCuentaPermitida`).
- `infra/equipo.js`: los nombres `aios-admin-*`.
- `infra/aios-stack.js`: sin el equipo, con `/aios/usuarios/pool-id`.
- `infra/app.js`: sin las variables del panel.
- `infra/stack-policy.json` e `infra/stack-policy-administrator.json` (nuevo).
- `scripts/check-stack-policy.mjs`: el stack por argumento y la marca de stack nuevo.
- `scripts/equipo.mjs`: exige `TABLA_EQUIPO` en producción.
- `src/lib/storage.js` y `src/lib/tabla-dynamo.js`: el nombre propio de la tabla del equipo.
- `package.json` y `.gitignore`: los comandos del stack del superadmin y su carpeta de salida.
- `tests/infra-stack.test.js`, `tests/infra-equipo.test.js`, `tests/check-stack-policy.test.js`, `tests/nombres-desplegados.test.js` y `tests/tabla-dynamo-transaccion.test.js`.
- `docs/INFRAESTRUCTURA.md` y `docs/COMANDOS-SUPERADMIN.md`.

**Panel (`aios-admin`):** sin cambios de código.

## Riesgos y preguntas abiertas

- **Coordinación con Omar (CB-1):** después de la mudanza, nadie despliega el backend desde una rama que todavía tenga el equipo. Esta spec llega a `branch-qa` con el PR de `superadmin_v2`.
- **El panel queda caído entre los pasos 2 y 6.** Hoy solo lo usa Jose.
- **Lo huérfano tiene protección contra borrado** (el pool, desde la fase 2): para borrarlo a mano, primero se le quita la protección.
