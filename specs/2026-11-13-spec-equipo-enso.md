# Spec: Administrar el equipo ENSŌ desde el panel

- **Fecha:** 2026-11-13
- **Origen:** pedido de Jose, 2026-11-13: «quiero que el superadmin pueda crear otros usuarios y controlar qué pueden hacer». Plan: `docs/2026-11-13-plan-equipo-enso.md` (raíz del workspace, fuera de git).
- **Estado:** borrador, con las decisiones cerradas.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en la rama `superadmin_v2`.
- **Despliegue:** solo el stack `AiosAdministrator` y el panel. No toca `AiosBackend` ni ENSŌ.

## Objetivo

El superadministrador da de alta desde el panel a las personas del equipo ENSŌ, decide a qué módulos entra cada una y con qué nivel, y les quita o les destraba el acceso sin abrir una terminal ni la consola de AWS. Hoy el alta solo existe por comando (`npm run equipo -- alta`) y la página «Equipo ensō» es de solo lectura.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Dar y quitar acceso van en la misma entrega**: alta y permisos (fase 1) con suspender, reactivar, reenviar la invitación, restablecer el MFA y retirar (fase 2). | Jose, 2026-11-13 |
| 2 | **Retirar borra el login y conserva la fila.** Se borra su cuenta del pool del equipo y su fila queda como `retirada`, sin permisos, con su nombre y su correo, para que la auditoría siga diciendo quién fue. Puede volver con un alta nueva. | Jose, 2026-11-13 |
| 3 | **El editor muestra solo los módulos que tienen pantalla** («no tiene sentido asignar lo que no existe»). Cuáles tienen pantalla sale de la tabla de rutas del panel, no de una lista escrita a mano: cuando una pantalla nueva sale, su módulo aparece solo en el editor. Lo que una persona ya tenía en un módulo sin pantalla se conserva al guardar, sin mostrarse. | Jose, 2026-11-13 |
| 4 | **Los cambios del equipo (`equipo#<sub>`) en la auditoría los ve solo el superadministrador.** Quien tiene `ver` en Gobernanza sigue viendo lo de las empresas. | Jose, 2026-11-13 |
| 5 | **Solo correos `@beenso.com` entran al equipo** (el dominio exacto, sin subdominios, sin importar mayúsculas). Lo valida el backend en toda alta, por la API y por el comando `npm run equipo -- alta`. No toca a quien ya está en el equipo con otro dominio: sigue entrando, se le pueden cambiar permisos, suspender, reactivar, restablecer el MFA y retirar; lo que no puede es volver a darse de alta con ese correo. | Jose, 2026-11-13 |
| 6 | **«Equipo ensō» no se asigna como módulo**: todo lo de esta spec es del superadministrador (regla vigente desde M2a, CA-13). | Vigente |
| 7 | **Nadie actúa sobre sí mismo.** Ni sus permisos (regla vigente) ni ninguna de las acciones nuevas. Así siempre queda un superadministrador activo: quien pide. | Vigente, se extiende |

## Alcance

- **Backend (código en `aios-backend`, desplegado en `AiosAdministrator`):**
  - `POST /v1/admin/equipo`: el alta, con sus permisos iniciales.
  - `GET /v1/admin/equipo`: suma el estado de la invitación de cada persona.
  - `GET /v1/admin/equipo/{sub}`: una persona.
  - `POST /v1/admin/equipo/{sub}/{accion}`: `suspender`, `reactivar`, `reenviar-invitacion`, `restablecer-mfa` y `retirar`.
  - El adaptador del pool del equipo (`cognito-del-equipo.js`) con las operaciones nuevas, los permisos de IAM sobre ese pool y su doble para el servidor local.
  - El estado nuevo `retirada` (decisión 2) y el filtro de la auditoría (decisión 4).
- **Panel (`aios-admin`, módulo `team`):**
  - La lista con la invitación, la fila que abre a la persona y «Nueva persona».
  - El formulario de alta.
  - La página de cada persona: sus datos, el editor de permisos, las acciones y su historia.
  - El editor de permisos, con el adelanto del menú que va a ver.

## Fuera de alcance

- El correo de invitación en español y con marca, y mandarlo por SES (fase 3 del plan). Sale el genérico de Cognito.
- «Último ingreso» de cada persona.
- Roles o plantillas de permisos.
- Cambiar el correo de una persona: el del pool del equipo no se puede cambiar (`mutable: false`); se retira y se da de alta otra vez.
- Delegar la administración del equipo en alguien que no sea superadministrador (decisión 6).
- Borrar el pool y la tabla huérfanos `aios-equipo` del stack del backend.
- El comando `npm run equipo -- alta` no cambia: sigue para crear al primer superadministrador o para una emergencia.

## Criterios de aceptación

### CA-1: Dar de alta a una persona [backend]
- **Dado** un superadministrador con MFA reciente
- **Cuando** pide `POST /v1/admin/equipo` con `{ correo: "Nati@Beenso.com", nombre: "Nati", permisos: { empresas: "ver", codigos: "editar" }, motivo: "entra a soporte", clave }`
- **Entonces**:
  - responde 201 con la persona: `actor`, `correo: "nati@beenso.com"`, `nombre`, `superadmin: false`, `estado: "activa"`, los `permisos` pedidos e `invitacion: "pendiente"`;
  - la cuenta queda creada en el pool del equipo (nunca en el de clientes), y Cognito le manda la contraseña temporal;
  - la fila queda en la tabla del equipo con esos permisos;
  - queda un evento `equipo.alta` con `objetivo: "equipo#<sub>"`, el motivo y `despues: { correo, superadmin, permisos }`.

### CA-2: Repetir el alta con la misma clave no crea dos [backend]
- **Dado** un alta ya hecha con la clave `K`
- **Cuando** llega otra vez el mismo pedido con `K` (un doble envío, un reintento tras un corte)
- **Entonces** responde 200 con la misma persona, sin un segundo evento, sin una segunda fila y sin pedirle a Cognito un correo nuevo.

### CA-3: La lista dice cómo va cada invitación [backend]
- **Dado** un equipo con una persona que nunca entró (alta de hace 3 horas), otra que nunca entró (alta de hace 2 días) y otra que ya entró
- **Cuando** el superadministrador pide `GET /v1/admin/equipo`
- **Entonces** cada persona trae `invitacion`: `"pendiente"`, `"vencida"` y `"aceptada"`, en ese orden, sacadas de una sola consulta al pool del equipo. La contraseña temporal vence a 1 día del alta (`tempPasswordValidity`).

### CA-4: Una persona del equipo [backend]
- **Dado** una persona del equipo
- **Cuando** el superadministrador pide `GET /v1/admin/equipo/{sub}`
- **Entonces** responde con la misma forma que una fila de la lista, `invitacion` incluida. Su historia sale de la auditoría que ya existe (`GET /v1/admin/auditoria?objetivo=equipo%23<sub>`).

### CA-5: Suspender corta el acceso en el momento [backend]
- **Dado** una persona activa con una sesión abierta en el panel
- **Cuando** un superadministrador pide `POST /v1/admin/equipo/{sub}/suspender` con su motivo
- **Entonces**:
  - su fila queda `suspendida`, con sus permisos intactos;
  - su cuenta del pool queda desactivada y sus sesiones cerradas;
  - su siguiente pedido a `/v1/admin/*` responde 403, aunque su token no haya vencido;
  - queda un evento `equipo.suspender` con el motivo.

### CA-6: Reactivar devuelve el acceso que tenía [backend]
- **Dado** una persona suspendida
- **Cuando** un superadministrador pide `.../reactivar` con su motivo
- **Entonces** su cuenta del pool queda activa, su fila vuelve a `activa` con los mismos permisos que tenía, puede entrar otra vez y queda un evento `equipo.reactivar`.

### CA-7: Reenviar la invitación [backend]
- **Dado** una persona que nunca entró, con la invitación pendiente o vencida
- **Cuando** un superadministrador pide `.../reenviar-invitacion` con su motivo
- **Entonces** Cognito le manda una contraseña temporal nueva, que vence a 1 día; la lista la muestra `pendiente` y queda un evento `equipo.reenviar-invitacion`.

### CA-8: Restablecer el MFA [backend]
- **Dado** una persona que perdió el teléfono con su app de códigos
- **Cuando** un superadministrador pide `.../restablecer-mfa` con su motivo
- **Entonces**:
  - su app de códigos queda desvinculada y sus sesiones cerradas;
  - al entrar con su contraseña, el pool le pide vincular una app nueva antes de dejarla pasar;
  - sus permisos no cambian;
  - queda un evento `equipo.restablecer-mfa`.

### CA-9: Retirar del equipo (decisión 2) [backend]
- **Dado** una persona activa o suspendida
- **Cuando** un superadministrador pide `.../retirar` con su motivo
- **Entonces**:
  - su cuenta se borra del pool del equipo;
  - su fila queda `retirada`, sin permisos y sin la marca de superadministrador, con su nombre y su correo;
  - no vuelve a entrar;
  - queda un evento `equipo.retirar` con los permisos que tenía en `antes`;
  - un alta nueva con el mismo correo crea otra cuenta, con otro `sub`, y la fila retirada sigue como estaba.

### CA-10: Todo esto es del superadministrador, con MFA reciente y motivo [backend]
- **Dado** las cinco acciones, el alta y el detalle
- **Cuando** las pide una persona activa que no es superadministradora (aunque tenga `editar` en todos los módulos), o un superadministrador cuyo último código tiene más de 15 minutos, o un superadministrador sin motivo
- **Entonces**:
  - la primera recibe 403;
  - la segunda, 401 con `codigo: "mfa-reciente"` (solo las que escriben: el detalle y la lista no piden MFA);
  - la tercera, 422 `sin-motivo`;
  - en ninguno de los tres casos se toca la tabla ni el pool.

### CA-11: Cada función toca solo el pool que le toca [backend]
- **Dado** la plantilla sintetizada de `AiosAdministrator`
- **Cuando** se leen los permisos de cada función
- **Entonces**:
  - las funciones del equipo tienen solo las acciones de Cognito que usan, solo sobre el ARN del pool del equipo;
  - ninguna función del equipo tiene permisos sobre el pool de clientes;
  - ninguna función de clientes gana permisos sobre el pool del equipo;
  - ninguna acción es `cognito-idp:*`.

### CA-12: Los cambios del equipo en la auditoría (decisión 4) [backend]
- **Dado** eventos `equipo#<sub>` y eventos de empresas en la auditoría
- **Cuando** los pide una persona con `ver` en Gobernanza que no es superadministradora, por la lista o por `?objetivo=equipo%23<sub>`
- **Entonces** no recibe ningún evento `equipo#…`, y sí los de las empresas que puede ver. El superadministrador ve todos.

### CA-13: En local funciona sin AWS [backend]
- **Dado** el backend en local (`npm run dev`, contra DynamoDB Local) con la identidad falsa del panel
- **Cuando** se da de alta, se suspende, se reactiva, se restablece el MFA, se reenvía la invitación y se retira a una persona
- **Entonces** todo responde como en AWS, contra un doble del pool del equipo que monta `scripts/dev-local.mjs`. El doble vive en `scripts/` y el paquete de Lambda no lo lleva (`PROHIBIDO` de `build-lambda-asset.mjs`).

### CA-14: La lista del equipo [panel]
- **Dado** el superadministrador en «Equipo ensō»
- **Cuando** abre la página
- **Entonces** ve, por persona:
  - nombre y correo, papel (Superadministrador o Equipo) y estado (Activa o Suspendida);
  - la invitación: «Invitación pendiente», «Invitación vencida» o nada si ya entró;
  - cuántos módulos con pantalla tiene.

  Además:
  - un clic en cualquier parte de la fila abre a la persona (`LinkedRow`);
  - el botón «Nueva persona» está arriba;
  - las retiradas van en una sección aparte, al final (decisión 2).

### CA-15: Nueva persona [panel]
- **Dado** el superadministrador en `team/new`
- **Cuando** escribe correo, nombre, elige permisos en el editor, escribe el motivo y oprime «Crear»
- **Entonces**:
  - mientras va, el botón dice «Creando…», queda bloqueado y lleva `aria-busy`;
  - el formulario lleva una clave que nace con él y viaja igual en cada reintento;
  - al crear, lleva a la página de la persona con el aviso: «Le llegó un correo con su contraseña temporal. Vence en 1 día; si no entra a tiempo, reenvía la invitación».

### CA-16: El editor de permisos [panel]
- **Dado** el editor, en el alta o en la página de una persona
- **Cuando** el superadministrador lo usa
- **Entonces**:
  - hay una fila por módulo, agrupadas como el menú;
  - cada fila ofrece «Sin acceso» y solo los niveles que admite su módulo (Gobernanza: «Ver»; Códigos: «Ver» o «Editar»);
  - un adelanto lista las entradas del menú que esa persona va a ver con lo elegido, calculado con la misma regla `can` y la misma tabla de rutas que arman el menú, y cambia al cambiar una fila;
  - solo aparecen los módulos que tienen al menos una ruta en `route-table.ts` (decisión 3): hoy Empresas, Usuarios de clientes, Consumo, Gobernanza y Códigos;
  - lo que la persona ya tenía en un módulo sin pantalla viaja igual al guardar: el `PUT` reemplaza el mapa entero, y sin eso se perdería sin que nadie lo viera;
  - marcar «Superadministrador» pide confirmar en un diálogo que dice que podrá todo, también administrar al equipo.

### CA-17: Guardar permisos [panel]
- **Dado** la página de una persona activa
- **Cuando** el superadministrador cambia filas del editor, escribe el motivo y oprime «Guardar permisos»
- **Entonces** el panel llama a `PUT /v1/admin/equipo/{sub}/permisos`, que ya existe, con los nombres del backend (`toApiPermissions`), y vuelve a la página con el aviso «Permisos guardados». «Guardar permisos» está desactivado mientras nada cambió.

### CA-18: Las acciones de una persona [panel]
- **Dado** la página de una persona
- **Cuando** se mira la sección «Acciones»
- **Entonces** ofrece solo lo que su estado permite:
  - activa: «Suspender», «Restablecer MFA» y «Retirar del equipo», más «Reenviar invitación» si nunca entró;
  - suspendida: «Reactivar» y «Retirar del equipo»;
  - retirada: ninguna acción, solo su historia.

  Cada una abre un diálogo de confirmación que dice qué va a pasar y pide el motivo. «Suspender» y «Retirar del equipo» van en rojo. Nada cambia hasta que se oprime el botón del diálogo, que queda bloqueado mientras va. Al terminar, la página vuelve con el aviso de lo hecho.

### CA-19: La historia de una persona [panel]
- **Dado** la página de una persona
- **Cuando** carga
- **Entonces** muestra sus eventos de auditoría (`equipo#<sub>`), el más reciente primero, con quién lo hizo, qué hizo y el motivo.

### CA-20: La página propia [panel]
- **Dado** el superadministrador en su propia página
- **Cuando** carga
- **Entonces** ve sus datos y su historia, sin editor ni acciones, con el texto «Tus permisos y tu acceso los cambia otro superadministrador».

### CA-21: Pedir el código otra vez [panel]
- **Dado** una acción que el backend rechaza con `mfa-reciente`
- **Cuando** el panel muestra el rechazo
- **Entonces** trae «Ingresar el código» (`FormRejection`), y al volver deja al superadministrador en la misma página, con lo que había escrito.

### CA-22: Solo el superadministrador [panel]
- **Dado** las rutas nuevas (`team/new`, `team/:sub` y sus acciones)
- **Cuando** se declaran en `route-table.ts`
- **Entonces** todas piden `superadmin`, y quien no lo es recibe la página de permiso negado, como hoy en `team`.

## Casos borde y de error

### CB-1: Un correo que no tiene forma de correo
- **Dado** un alta con `correo: "nati@"`
- **Cuando** llega al backend
- **Entonces** responde 422 con `campo: "correo"`, sin tocar el pool ni la tabla, y el panel lo muestra junto al campo.

### CB-1b: Un correo de otro dominio (decisión 5)
- **Dado** un alta con `nati@gmail.com`, `nati@holaamigo.ai` o `nati@soporte.beenso.com`
- **Cuando** llega al backend, por la API o por `npm run equipo -- alta`
- **Entonces** responde 422 con `codigo: "correo-fuera-del-dominio"` y `campo: "correo"`, sin tocar el pool ni la tabla. El panel lo muestra junto al campo, que además dice «Solo correos @beenso.com».

### CB-1c: Quien ya está con otro dominio
- **Dado** una persona del equipo dada de alta antes de esta regla con un correo que no es `@beenso.com`
- **Cuando** un superadministrador le cambia permisos, la suspende, la reactiva, le restablece el MFA o la retira
- **Entonces** todo funciona igual que con un correo `@beenso.com`: la regla del dominio vale solo para las altas.

### CB-2: Permisos que no existen
- **Dado** un alta o un cambio con `{ "documentos-texto": "editar" }` o `{ "equipo": "ver" }`
- **Cuando** llega al backend
- **Entonces** responde 422 diciendo qué módulo o qué nivel no se admite (`errorDePermisos`), sin tocar nada.

### CB-3: Un correo que ya está en el equipo
- **Dado** una persona activa o suspendida con `nati@beenso.com`
- **Cuando** llega un alta de `NATI@beenso.com` con otra clave
- **Entonces** responde 409 `ya-en-el-equipo` con su `sub`, y el panel dice «Ya está en el equipo» con un enlace a su página. Una persona retirada con ese correo no cuenta.

### CB-4: Un alta que quedó a medias
- **Dado** una cuenta en el pool del equipo sin su fila (el alta se cortó después de Cognito)
- **Cuando** se repite el alta
- **Entonces** crea la fila con los permisos pedidos, sin pedirle a Cognito un correo nuevo, y responde que la cuenta ya existía: entra con la contraseña que le llegó la primera vez (o se le reenvía la invitación).

### CB-5: Cognito no responde en el alta
- **Dado** el pool del equipo caído o lento
- **Cuando** se pide un alta
- **Entonces** responde 503 sin escribir en la tabla, y repetir el mismo pedido termina el alta.

### CB-6: Una acción que se corta a medias
- **Dado** «suspender», con la fila ya escrita y Cognito sin responder al desactivar la cuenta
- **Cuando** termina el pedido
- **Entonces**:
  - responde 503 `accion-incompleta` diciendo qué quedó hecho;
  - la persona ya no entra al panel, porque la fila la frena;
  - repetir la acción termina lo que faltó.

  Reactivar va al revés: primero Cognito y después la fila, para que nunca quede una fila activa con la cuenta desactivada.

### CB-7: Sobre uno mismo
- **Dado** un superadministrador
- **Cuando** pide cualquiera de las cinco acciones, o un cambio de permisos, sobre su propio `sub`
- **Entonces** responde 409 `a-si-mismo`, sin tocar nada.

### CB-8: Una acción que el estado no permite
- **Dado** una persona
- **Cuando** se pide reactivar a una activa, suspender a una suspendida, cualquier acción sobre una retirada, o reenviar la invitación a quien ya entró
- **Entonces** responde 409 `estado-no-permite` (o `invitacion-aceptada` en el último caso), sin tocar nada.

### CB-9: Dos superadministradores cambian a la misma persona
- **Dado** dos superadministradores con la misma página abierta
- **Cuando** los dos guardan o actúan casi a la vez
- **Entonces** el primero gana y el segundo recibe 409 `conflicto` («otro cambio llegó primero: vuelve a cargar y repítelo»), sin pisar al primero.

### CB-10: Dos superadministradores se suspenden el uno al otro a la vez
- **Dado** los dos únicos superadministradores activos, A y B
- **Cuando** A suspende (o retira) a B y B suspende a A en el mismo momento
- **Entonces** a lo más uno de los dos pedidos se aplica: cada acción comprueba, en la misma escritura, que quien pide sigue activo. Nunca quedan los dos fuera.

### CB-11: Retirar o suspender a otro superadministrador
- **Dado** dos superadministradores activos
- **Cuando** uno retira o suspende al otro
- **Entonces** se permite, porque quien pide sigue siendo superadministrador activo.

### CB-12: Cognito no responde al armar la lista
- **Dado** el pool del equipo caído
- **Cuando** se pide `GET /v1/admin/equipo` o el detalle
- **Entonces** responde igual, con `invitacion: null` en cada persona, y el panel muestra «—» en esa columna sin error de pantalla.

### CB-13: Una persona suspendida con el panel abierto
- **Dado** una persona suspendida mientras navega el panel
- **Cuando** pide la siguiente página
- **Entonces** `/yo` responde 403, y el panel borra su sesión y la lleva a «sin acceso», nunca al login (regla del panel).

### CB-14: El mismo correo con mayúsculas
- **Dado** un alta con `Nati@BEENSO.com`
- **Cuando** se guarda
- **Entonces** el correo queda en minúsculas, y un alta posterior de `nati@beenso.com` cae en CB-3.

### CB-15: Un pedido demasiado grande o que no es JSON
- **Dado** un cuerpo de más de 16 KB, o uno que no es JSON
- **Cuando** llega a cualquiera de las rutas nuevas
- **Entonces** responde 413 o 422, como el cambio de permisos que ya existe.

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-2, CB-1, CB-1b, CB-2, CB-3, CB-4, CB-5, CB-14, CB-15 | integración (handler + tabla en memoria + doble de Cognito) | `aios-backend/tests/admin-equipo-alta.test.js` (nuevo) y `tests/equipo-alta.test.js` (el comando) |
| CB-1c | integración | `aios-backend/tests/admin-equipo-acciones.test.js` y `admin-equipo-permisos-endpoint.test.js` |
| CA-3, CA-4, CB-12 | integración | `aios-backend/tests/admin-equipo-endpoint.test.js` |
| CA-5 a CA-9, CB-6 a CB-11 | integración | `aios-backend/tests/admin-equipo-acciones.test.js` (nuevo) |
| CA-10 | integración | `aios-backend/tests/admin-permisos-por-ruta.test.js` y los dos nuevos |
| CA-11 | plantilla sintetizada | `aios-backend/tests/infra-equipo.test.js` |
| CA-12 | integración | `aios-backend/tests/admin-auditoria-endpoint.test.js` |
| CA-13 | integración | `aios-backend/tests/dev-local-admin.test.js` |
| CB-13 | ya cubierto | `aios-admin/tests/permissions-middleware.test.ts` |
| CA-14 a CA-21 | unit (traducción, reglas puras) + render estático | `aios-admin/tests/team.test.ts` (nuevo) |
| CA-22 | unit | `aios-admin/tests/routes-declare-permission.test.ts` |
| CA-5, CA-8 (entrar de nuevo), CA-15 (correo real) | manual, en producción | recorrido con un correo propio después del deploy |

## Archivos probablemente afectados

**Backend (`aios-backend`):**
- `src/lib/admin/cognito-del-equipo.js` — operaciones nuevas: desactivar, activar, cerrar sesiones, desvincular la app de códigos, reenviar, borrar y el estado de las invitaciones.
- `src/lib/admin/alta-del-equipo.js` — el alta con permisos iniciales y clave, para la API y el comando.
- `src/lib/admin/permisos-del-equipo.js` — el estado `retirada`, la vista con `invitacion` y la comprobación de que quien pide sigue activo (CB-10).
- `src/lib/admin/acciones-del-equipo.js` (nuevo) — las cinco acciones, sus reglas y su orden.
- `src/lib/admin/auditoria.js` — el filtro de `equipo#…` para quien no es superadministrador (decisión 4).
- `src/handlers/admin-equipo-alta.js`, `admin-equipo-persona.js`, `admin-equipo-accion.js` (nuevos) — las rutas.
- `src/handlers/admin-equipo.js` — la invitación en la lista.
- `src/lambda.js` — las rutas en `RUTAS_ADMIN`.
- `src/lib/admin/rutas-de-escritura.js` — los estados de los rechazos nuevos.
- `infra/equipo.js` — las rutas, las funciones y su IAM sobre el pool del equipo.
- `scripts/dev-local.mjs` y un doble del pool en `scripts/` — CA-13.
- `scripts/equipo.mjs` — usa el alta compartida.
- `package.json` — los tests nuevos en la lista de `npm test`.
- `docs/COMANDOS-SUPERADMIN.md`, `docs/INFRAESTRUCTURA.md` — las rutas y los permisos nuevos.

**Panel (`aios-admin`):**
- `app/domain/permissions.ts` — el estado `retired`, y el estado de la invitación en `TeamMember` (o un tipo propio del módulo).
- `app/domain/team.ts` (nuevo) — las acciones por estado.
- `app/shared/routing/route-table.ts` — de aquí sale qué módulos tienen pantalla (decisión 3).
- `app/shared/api/team-member-mapping.ts` — la traducción de la invitación y de `retirada`.
- `app/shared/api/admin-read-api.server.ts` — el detalle de una persona y su historia.
- `app/shared/api/admin-write-api.server.ts` — alta, acciones y cambio de permisos (`PUT`).
- `app/shared/api/write-mapping.ts` — los rechazos nuevos (`ya-en-el-equipo`, `a-si-mismo`, `estado-no-permite`, `invitacion-aceptada`, `accion-incompleta`).
- `app/shared/routing/route-table.ts` — `team/new` y `team/:sub`.
- `app/modules/team/` — rutas `team.tsx`, `team-new.tsx` y `team-member.tsx`, y componentes `team-table`, `permissions-editor` (con su CSS), `menu-preview`, `team-member-facts`, `team-member-actions`, `team-action-dialog` y `team-history`, cada uno en su archivo.
- `tests/team.test.ts` (nuevo), `tests/routes-declare-permission.test.ts`.

## Riesgos y preguntas abiertas

- **Personas del equipo con otro dominio:** siguen entrando (CB-1c), pero si se retiran no pueden volver con ese correo. Antes de desplegar conviene mirar la lista del equipo y decidir si alguien cambia a su correo `@beenso.com`.
- **Un alta manda un correo real.** La prueba en producción se hace con un correo propio y se retira al terminar.
- **La contraseña temporal vence en 1 día** (`tempPasswordValidity`). Por eso entra «Reenviar invitación».
- **El correo genérico de Cognito** sale en inglés y desde un remitente de AWS, y puede caer en spam. Si pasa, se adelanta la invitación con marca.
- **Recursos de `AiosAdministrator`:** cada ruta suma unos 3 recursos. Se cuenta con la plantilla sintetizada antes de desplegar.
- **Restablecer el MFA en el pool del equipo** usa el mismo camino que «destrabar» de los clientes (`AdminDeleteSoftwareToken` y cerrar sesiones), probado en producción sobre el otro pool. En el del equipo el MFA es obligatorio: falta comprobar en producción que al entrar pide vincular la app nueva (CA-8).
