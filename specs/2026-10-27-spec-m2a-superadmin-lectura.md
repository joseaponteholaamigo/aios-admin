# Spec: M2a · El superadmin en modo lectura (empresas, personas, auditoría y equipo)

- **Fecha:** 2026-10-27
- **Origen:** idea interna. Es la fase M2 del plan (`2026-10-20-plan-superadmin-aws.md`, §13), que Jose partió en dos el 2026-10-27: M2a lee, M2b cambia. El plan vive en `docs/` de la raíz del workspace, fuera de este repo, porque nombra clientes reales.
- **Estado:** aprobada por Jose (2026-10-28)
- **Dónde se implementa:** en la rama `superadmin_v2` de los dos repos. El panel va en este repo; el backend, en `aios-backend` (worktree `aios-backend-superadmin`).
- **Proyectos:** `aios-backend` (los CA marcados **[backend]**), `aios-admin` (**[panel]**) y la infraestructura del panel (**[infra]**).
- **Decisiones que la enmarcan** (Jose, 2026-10-27 y 2026-10-28):
  - **Datos reales (opción b):** mientras no pase una revisión de seguridad aparte, la API de admin muestra solo la empresa de pruebas (`desarrollo-enso-78479d`).
  - **Catálogo privado (decisión 8 = a):** también espera a esa revisión, así que pasa a M2b. M2a muestra los nombres técnicos de las piezas, sin etiqueta.
  - **Sin «Ver como»:** el panel no lo tiene (plan §3.5). ENSŌ es una app de escritorio; el superadmin cambia lo que necesite del cliente, y cada cambio queda en la auditoría.
  - **La plantilla visual:** el panel nuevo reusa la del panel viejo de beenso (`/administrador`, en Vercel): sus tokens, su marco, sus íconos, sus tipografías y la forma de sus pantallas. La referencia es `beenso` en el commit `d74d3fb`: `src/lib/administrador/admin.css`, `src/lib/administrador/iconos.ts`, `src/pages/administrador/_Layout.astro` y las páginas de cada módulo. beenso no se toca: solo se lee.
  - **Para M2b, no para esta spec:** el equipo escribe roles y acceso de cualquier cliente (decisión 4 = a), y el MFA reciente se exige solo con `auth_time` (opción B, plan §3.3).

## Objetivo

Que el equipo ensō consulte desde el panel lo que hoy consulta por terminal: qué empresas hay y en qué plan están, quién está en cada una y con qué acceso, qué hizo el equipo y si hay datos inconsistentes. M2a no cambia ningún dato. Hasta que pase la revisión de seguridad, solo se ve la empresa de pruebas.

## Alcance

**[backend] `aios-backend`**
- **La lista de empresas visibles:** viene de la configuración y el backend la aplica en todos los endpoints de M2a. Es el filtro temporal de la opción b.
- **Empresas:**
  - `GET /v1/admin/clientes`, con búsqueda y paginación;
  - `GET /v1/admin/clientes/{id}`;
  - `GET /v1/admin/clientes/{id}/historia`.
- **Personas:**
  - `GET /v1/admin/clientes/{id}/personas`;
  - `GET /v1/admin/personas`: la lista de las personas de todas las empresas visibles (CA-33);
  - `POST /v1/admin/personas/buscar`;
  - `GET /v1/admin/doctor`: la revisión de datos. Va con las personas porque sus hallazgos traen correos (decisión de Jose, 2026-10-28).
- **Auditoría y equipo:** `GET /v1/admin/auditoria` y `GET /v1/admin/equipo`.
- **Las rutas nuevas** van en las dos listas (`src/lambda.js` e `infra/equipo.js`), en el servidor local y en el stack. Sus funciones tienen permisos de solo lectura.

**[panel] `aios-admin`**
- **La plantilla visual del panel viejo:** los tokens de color y los dos temas, el marco (barra lateral y barra superior), los íconos y las tipografías servidas desde el propio panel. La usan también las pantallas de M1.
- **Empresas:** la lista y la ficha con su historia.
- **Usuarios de clientes:** la lista de las personas de los clientes y la búsqueda por correo; las personas, los roles y la bitácora de una empresa; y la revisión de datos (el doctor).
- **Gobernanza:** la auditoría.
- **Equipo ensō:** la lista de personas, solo para el superadministrador.
- **Lo que comparten las pantallas:**
  - el acceso `superadmin` en la tabla de rutas;
  - los métodos nuevos del cliente de la API, con su traducción;
  - el aviso de que solo se ven algunas empresas.

**[infra]**
- **La prueba rápida (smoke)** después de cada despliegue cubre las rutas nuevas.

## Fuera de alcance

- **Todo lo que escribe** es M2b:
  - crear empresas y personalizarlas;
  - dar o quitar acceso;
  - invitar, cambiar de rol o revocar personas;
  - los roles y el acceso por persona (decisión 4);
  - las altas y los permisos del equipo, con la protección B del MFA, y conectar CA-23 de M1.
- **«Ver como»:** Jose lo descartó el 2026-10-28 (plan §3.5). Ni el panel ni la API de admin calculan «lo que le llega» a una persona.
- **Lo del panel viejo que depende de datos que M2a no tiene:** el botón «Nueva empresa», los contadores del menú, las alertas, el buscador global y los módulos de M3 y M5. La plantilla los deja fuera hasta su fase.
- **El catálogo privado** (decisión 8), que espera a la revisión de seguridad y pasa a M2b. M2a muestra los nombres técnicos de las skills, agentes y cadenas.
- **La revisión de seguridad que levanta el filtro,** y levantarlo. Es una tarea aparte, después de M2a.
- **El estado de la cuenta de Cognito de una persona de un cliente** (por ejemplo, si confirmó el correo). La API de admin tendría que leer el pool de clientes, y eso choca con la regla de no mezclar pools. Queda como pregunta abierta.
- **Lo que comparten los equipos** (la capa de equipo y las capacidades compartidas) y **el contenido de cualquier skill:** la API de admin no lo lee ni lo devuelve (decisión D-1).
- **Unificar las tres bitácoras** (`eventos:<t>`, `gobierno:<t>` y la tabla `eventos`). M2a las lee juntas sin moverlas. `ficha-de-cliente.js` del stash entra en M2b, con la primera escritura de una ficha.
- **Otros módulos y piezas:**
  - Vista general, Consumo, Entrevistas, Documentos y Skills (M3 y M5);
  - `POST /v1/admin/eventos` (M3);
  - las exportaciones y el refresco automático de las pantallas.
- **Los pendientes del `quality-gate` de M1** (B-1 a B-9), salvo que una ruta nueva repita el defecto. CA-18 de esta spec cubre el de B-5 en las rutas nuevas.

## Vocabulario de la API

- **Recursos** (en español, como el resto del backend): `clientes`, `personas`, `auditoria` y `equipo`. En el panel se traducen a `companies`, `clientUsers`, `auditEvents` y `team`, solo en `app/shared/api/`.
- **Empresa visible:** la que está en la lista de empresas visibles. Para la API de admin, una empresa fuera de esa lista no existe.
- **El módulo que exige cada ruta:**

| Ruta (bajo `/v1/admin`) | Módulo y nivel |
|---|---|
| `GET /clientes`, `GET /clientes/{id}`, `GET /clientes/{id}/historia` | `empresas: ver` |
| `GET /clientes/{id}/personas`, `GET /personas`, `POST /personas/buscar`, `GET /doctor` | `usuarios: ver` |
| `GET /auditoria` | `gobernanza: ver` |
| `GET /equipo` | solo superadministrador |

## Criterios de aceptación

### El filtro de empresas visibles

#### CA-1: La lista de empresas visibles es obligatoria [backend]
- **Dado** el stack del backend
- **Cuando** se sintetiza la segunda pasada (con la URL del panel en `AIOS_ADMIN_URLS`) sin `AIOS_ADMIN_CLIENTES`
- **Entonces** el synth falla con un mensaje que dice cómo pedirla, igual que sin `AIOS_ADMIN_URLS`. La primera pasada no la necesita: no monta la API de admin.
- **Y** con `AIOS_ADMIN_CLIENTES=desarrollo-enso-78479d`, cada función de M2a recibe esa lista en su entorno.
- **Y** el valor es `todos` o una lista de ids separados por coma, con la forma de los que arma `idDeTenant`: el nombre hecho slug y seis caracteres hexadecimales. Cualquier otro valor hace fallar el synth: uno vacío, un id con otra forma o un error de tipeo como `todas`.

#### CA-2: El filtro vive en el backend, en un solo lugar [backend]
- **Dado** dos empresas, una visible y otra no
- **Cuando** se pide cada ruta de M2a sobre la empresa no visible, o se busca el correo de una persona de esa empresa
- **Entonces** cada ruta responde igual que si la empresa no existiera:
  - 404 en las rutas con `{id}`;
  - `{ encontrada: false }` en la búsqueda.
- **Y** la lista de empresas, el doctor y la auditoría no la muestran.
- **Y** la decisión de qué empresa es visible vive en una sola función de `src/lib/admin/`, que usan todas las rutas.
- **Y** la prueba recorre todas las rutas de lectura de `RUTAS_ADMIN` y falla si alguna queda sin cubrir, para no quedar en verde sin revisar nada.

#### CA-3: Sin la lista, no se ve ninguna empresa [backend]
- **Dado** una función de M2a sin la variable de la lista en su entorno (en local, por ejemplo)
- **Cuando** se pide la lista de empresas
- **Entonces** responde 200 con la lista vacía y `soloAlgunas: true`.
- **Y** el log avisa que falta la variable, sin nombrar empresas ni correos.

#### CA-4: Las respuestas y el panel avisan cuando hay filtro [backend, panel]
- **Dado** una lista distinta de `todos`
- **Cuando** se pide la lista de empresas, el doctor, la auditoría o la búsqueda de personas
- **Entonces** la respuesta trae `soloAlgunas: true`.
- **Y** el panel muestra en Empresas, Usuarios de clientes y Gobernanza el aviso «Por ahora el panel muestra solo las empresas de prueba».
- **Y** con `todos`, `soloAlgunas` vale `false` y el aviso no aparece.

### Empresas

#### CA-5: La lista de empresas [backend]
- **Dado** tres empresas visibles
- **Cuando** una persona con `empresas: ver` pide `GET /v1/admin/clientes`
- **Entonces** recibe 200, con `cache-control: no-store`, y `{ clientes, siguiente, soloAlgunas }`, ordenadas por nombre.
- **Y** cada empresa trae solo estos campos:
  - `id` y `nombre`;
  - `plan`: el contratado, que es `personalizado` o el tier;
  - `estado`;
  - `vencimiento`: `{ vencido, vencidoPor, hasta }`;
  - `aviso`: el de `avisoDeVencimiento`;
  - `asientos`: `{ usados, tope }`;
  - `admins`: cuántos tiene;
  - `pagaPorStripe` y `creadaEl`.
- **Y** ninguna trae `licenseKeyHash`, `publishKeyHash`, `stripeCustomerId`, `etag` ni otro campo de la fila, porque es una lista blanca. La prueba agrega un campo nuevo a la fila y comprueba que no sale.
- **Y** el plan, el vencimiento y los asientos salen de las mismas funciones que usan el manifest y `tenant list`: `esPersonalizado`, `vencimientoDe`, `asientosEfectivos`, `cuposUsados` y `avisoDeVencimiento`.

#### CA-6: Búsqueda y paginación [backend]
- **Dado** 120 empresas visibles
- **Cuando** se pide la lista sin parámetros, con `?limite=10`, con `?cursor=<siguiente>` y con `?q=<texto>`
- **Entonces**:
  - sin parámetros vienen 50 y un `siguiente`;
  - `limite` acepta de 1 a 100;
  - la última página trae `siguiente: null`;
  - recorrer todas las páginas devuelve cada empresa una sola vez;
  - `q` filtra por nombre o id antes de paginar, sin distinguir mayúsculas ni tildes.
- **Y** responde 422 con un `limite` fuera de rango, o con un `cursor` que no tiene la forma de los que emite esta API. El cursor no va firmado: uno fabricado con la forma correcta solo empieza la lista en otro lugar, y el filtro y los permisos se aplican igual.

#### CA-7: La ficha de una empresa [backend]
- **Dado** una empresa visible con plan Personalizado y reglas de acceso de empresa
- **Cuando** se pide `GET /v1/admin/clientes/{id}`
- **Entonces** trae lo mismo que la lista, y además:
  - `planEfectivo`: tier, preset, banderas, cupos, asientos y `manejaAsientos`, de `planEfectivo`;
  - `condiciones`, si es Personalizado: asientos, contenido, equipo, horarios, fecha de fin y cupos;
  - `acceso`: lo que muestra `vistaDeAcceso` sin `roles` ni `personas`. Es decir, la base de su contenido, sus reglas de empresa con `inexistente` e `inactiva`, y cuántas skills, agentes y cadenas recibe.
- **Y** no trae correos de personas: esos son del módulo Usuarios de clientes.
- **Y** si no hay dependencias publicadas, `acceso` viene en `null` con `accesoPendiente`, que dice qué falta. El resto de la ficha responde igual, y el log dice qué hay que publicar.

#### CA-8: La historia de una empresa [backend]
- **Dado** una empresa visible con eventos en su bitácora de cuenta (`eventos:<id>`) y en la auditoría (`tenant#<id>`)
- **Cuando** se pide `GET /v1/admin/clientes/{id}/historia`
- **Entonces** vienen las dos fuentes juntas, del más nuevo al más viejo.
- **Y** cada evento trae `origen` (`cuenta` o `auditoria`), `fecha`, `actor`, `que` y `motivo`. Los de `cuenta` traen además `detalle`; los de `auditoria`, `canal`, `antes` y `despues`.
- **Y** `?limite` acepta de 1 a 200, con 100 por defecto, y se aplica después de juntar las dos fuentes.
- **Y** no incluye la bitácora de gobierno (`gobierno:<id>`), que nombra a las personas: esa va con las personas (CA-10).

#### CA-9: La revisión de datos (doctor) [backend]
- **Dado** el mismo defecto plantado en una empresa visible y en una no visible (un asiento sin índice de correo)
- **Cuando** se pide `GET /v1/admin/doctor`
- **Entonces** trae los mismos tipos de hallazgo que `npm run tenant -- doctor`, porque salen de `diagnosticarClientes` y no de otra implementación.
- **Y** trae solo los hallazgos de empresas visibles, más `fueraDeLoVisible` con cuántos quedaron fuera.
- **Y** las credenciales huérfanas, que no pertenecen a ninguna empresa, se cuentan en `fueraDeLoVisible` salvo con `todos`.
- **Y** ningún hallazgo trae un hash completo, solo sus primeros 12 caracteres.
- **Y** no modifica nada: su función no tiene permiso de escritura (CA-16).

### Usuarios de clientes

#### CA-10: Las personas y los roles de una empresa [backend]
- **Dado** una empresa visible con una admin, una persona con rol, una invitada y una revocada
- **Cuando** una persona con `usuarios: ver` pide `GET /v1/admin/clientes/{id}/personas`
- **Entonces** trae `personas`, `roles` y `empresa` con la misma forma y los mismos valores que `GET /v1/team/acceso` le da a la admin de esa empresa (`vistaDelEquipo`), más las fechas de cada asiento (`invitadoEl` y `aceptadoEl`). La prueba compara contra la salida de `vistaDelEquipo` con los mismos datos.
- **Y** trae aparte `revocadas`, con el correo y `revocadoEl` de cada persona revocada, que «Mi equipo» no muestra.
- **Y** trae `bitacora`, con las últimas 50 entradas de la bitácora de gobierno de la empresa.
- **Y** no trae contenido de skills ni URLs de descarga.
- **Y** sin dependencias publicadas responde 503, como `GET /v1/team/acceso`.

#### CA-11: Buscar personas por un pedazo de su correo [backend]
- **Dado** personas con asiento en empresas visibles
- **Cuando** se pide `POST /v1/admin/personas/buscar` con `{ texto, empresa? }`, aunque el texto venga con mayúsculas o espacios
- **Entonces** responde 200 con `{ personas, hayMas, soloAlgunas }`: las personas cuyo correo contiene el texto, ordenadas por correo, con la forma de CA-33, hasta 100. `hayMas` dice si hubo más.
- **Y** con `empresa` (un id exacto) busca solo en esa empresa.
- **Y** la revocada, la de una empresa no visible y la que no existe no aparecen, y las tres se ven igual: nada dice que estén.
- **Y** va por POST para que lo que se escribe de un correo no quede en la URL ni en los logs de acceso.
- **Y** un cuerpo sin `texto`, con uno vacío, con algo que no es texto o con uno más largo que un correo (254) responde 422.

#### CA-33: La lista de las personas de los clientes [backend, panel]
- **Dado** personas en dos empresas visibles y en una no visible, una persona revocada y una entrada del índice sin asiento
- **Cuando** una persona con `usuarios: ver` pide `GET /v1/admin/personas`
- **Entonces** responde `{ personas, siguiente, empresas, soloAlgunas }`, con las personas ordenadas por correo y paginadas como en CA-6: 50 por defecto y hasta 100.
- **Y** cada persona trae `correo`, `empresa: { id, nombre }`, `rol`, `admin`, `estado`, `invitadoEl` y `aceptadoEl`, y nada más.
- **Y** no trae a las revocadas, a las de una empresa no visible ni las entradas sin asiento, igual que la búsqueda (CA-11).
- **Y** `empresas` trae todas las empresas visibles, sin importar el filtro ni el cursor, como `{ id, nombre, equipo }`, ordenadas por nombre sin tildes ni mayúsculas. `equipo` dice si su plan es de más de un asiento (o de un tope que todavía no se conoce). Nunca nombra una empresa no visible.
- **Y** con `?empresa=<id>` trae solo las personas de esa empresa, por su id exacto. Un id que no existe o de una empresa no visible no trae a nadie.
- **Y** el cursor no lleva ningún correo, porque viaja en la URL (la razón de CA-11). Lleva la posición en la lista: si alguien entra o sale entre una página y la siguiente, una persona puede repetirse o saltarse. Vale solo para el mismo filtro: con otro responde 422 (CB-3).
- **Y** en el panel, la tarjeta «Personas» tiene una sola barra de filtros, como la del panel viejo, y cada filtro se aplica solo, sin botón:
  - la búsqueda por correo (CA-11) se aplica medio segundo después de la última tecla, por POST y sin cambiar la dirección; con texto, una X dentro de la caja lo borra y vuelve a la lista;
  - la lista desplegable de empresas, con dos grupos («Empresas con equipo» y «Empresas de un solo asiento»), se aplica al elegir y viaja en la dirección (`?company=`);
  - un solo botón, «Borrar filtros», visible si hay alguno, limpia los dos.
- **Y** con texto, el resultado reemplaza la lista: la misma tabla, sin páginas, combinado con la empresa elegida, con cuántas personas encontró y, si hubo más de 100, un aviso para escribir más.
- **Y** al recargar, la búsqueda se limpia (el texto no está en la dirección) y la empresa se conserva.
- **Y** cambiar de filtro o de página no saca el esqueleto de carga: la pantalla se queda, con la lista atenuada, para no borrar lo que se está escribiendo.
- **Y** la empresa de cada persona lleva a sus personas (`client-users/:companyId`), y la paginación de Empresas conserva el filtro.

### Gobernanza y equipo

#### CA-12: La auditoría [backend]
- **Dado** eventos en la tabla `eventos` sobre personas del equipo (`equipo#<sub>`), sobre una empresa visible y sobre una no visible
- **Cuando** una persona con `gobernanza: ver` pide `GET /v1/admin/auditoria`
- **Entonces** vienen del más nuevo al más viejo, paginados como en CA-6: 50 por defecto y hasta 100.
- **Y** cada evento trae `fecha`, `actor`, `canal`, `operacion`, `objetivo`, `motivo`, `antes` y `despues`.
- **Y** no aparecen los eventos de la empresa no visible.
- **Y** `?objetivo=` filtra por objetivo (`tenant#<id>` o `equipo#<sub>`), y un objetivo con forma inválida responde 422.

#### CA-13: La lista del equipo ensō [backend]
- **Dado** tres personas en la tabla del equipo, una de ellas suspendida
- **Cuando** un superadministrador pide `GET /v1/admin/equipo`
- **Entonces** recibe las tres, con la forma de `vistaDePersona` (la misma de `/yo`), ordenadas por nombre.
- **Y** quien no es superadministrador recibe 403, aunque tenga `editar` en todos los módulos.

### Rutas, permisos e infraestructura del backend

#### CA-14: Cada ruta exige su módulo [backend]
- **Dado** la tabla de módulos del Vocabulario
- **Cuando** se pide cada ruta de M2a con:
  - (a) el módulo y el nivel que exige;
  - (b) otro módulo, con `editar`;
  - (c) ningún permiso;
  - (d) un superadministrador;
  - (e) una persona suspendida;
  - (f) ningún token
- **Entonces** (a) y (d) pasan, (b), (c) y (e) dan 403, y (f) da 401.
- **Y** la prueba tiene escrita la tabla de casos, con una fila por ruta.

#### CA-15: Las rutas están en las dos listas, y no en la API pública [backend]
- **Dado** `RUTAS_ADMIN` (`src/lambda.js`) y `RUTAS_DE_ADMIN` (`infra/equipo.js`)
- **Cuando** corre `tests/infra-equipo.test.js`
- **Entonces** las dos listas tienen las mismas rutas nuevas, cada una con el autorizador del equipo y el scope `admin/acceso`.
- **Y** ninguna ruta nueva aparece en la API pública.
- **Y** el candado de CA-5 de M1 sigue en verde: ninguna función nueva recibe variables del pool de clientes.

#### CA-16: Las funciones nuevas solo leen [backend]
- **Dado** el stack sintetizado
- **Cuando** se inspeccionan los roles de las funciones nuevas
- **Entonces**:
  - **sobre `tenants`:** solo lectura, la que da `grantReadData`. Nunca `PutItem`, `UpdateItem`, `DeleteItem` ni `BatchWriteItem`;
  - **sobre el bucket de bundles:** solo lectura, y solo las funciones que leen las dependencias: la ficha y las personas;
  - **sobre `eventos`:** solo lectura, y solo lo que usa cada una: la historia, `Query`; Gobernanza, además `Scan`. M2a no escribe eventos;
  - **sobre la tabla del equipo:** solo lectura.

#### CA-17: El servidor local monta las rutas [backend, manual]
- **Dado** `npm run dev` del backend
- **Cuando** se pide cada ruta de admin sin token
- **Entonces** responde 401, nunca 404: está montada y con su puerta. Lo comprueba `tests/dev-local-admin.test.js`.
- **Y** con DynamoDB Local y un token de superadministrador de la identidad falsa, `GET /v1/admin/clientes` responde 200. Esta parte se comprueba a mano antes del primer despliegue: la prueba automática no tiene el pool del equipo. El 200 de cada ruta lo cubren las pruebas de los handlers.

#### CA-18: Parámetros raros no rompen las rutas [backend]
- **Dado** las rutas con `{id}`
- **Cuando** llega un `{id}` con `%` mal codificado, `__proto__`, más de 80 caracteres o caracteres fuera de `[a-z0-9-]`
- **Entonces** responde 404, nunca 500.
- **Y** en la búsqueda por correo, un cuerpo de más de 16 KB responde 413, y uno que no es JSON, 422.

#### CA-19: Ningún correo en los logs [backend]
- **Dado** las pruebas de cada handler nuevo, con `context.log` y `context.warn` capturados
- **Cuando** corren todos sus casos
- **Entonces** ninguna línea capturada contiene `@`.

#### CA-20: Las pruebas nuevas corren de verdad [backend]
- **Dado** `package.json` de `aios-backend`
- **Cuando** se revisa la lista de `npm test`
- **Entonces** cada archivo `tests/*.test.js` nuevo de M2a está en ella. Las listas se escriben a mano: un test que no está ahí no corre.
- **Y** `npm test` termina en verde, con los fallos de antes de M2a en el mismo estado. Se compara la lista de nombres de los fallidos, no el conteo.

#### CA-21: La rama trae lo que está en `branch-qa` antes de cada despliegue [backend]
- **Dado** la rama `superadmin_v2` del backend
- **Cuando** se va a correr un `infra:deploy` de M2a
- **Entonces** `git merge-base --is-ancestor origin/branch-qa superadmin_v2` sale con 0.
- **Y** `npm test` sigue en verde después de mezclar `branch-qa`, si hizo falta mezclarla.
- **Por qué:** un despliegue borra todo recurso que no está en la rama desde la que se despliega. Al 2026-10-28, `superadmin_v2` es igual a `branch-qa`, que ya trae compartir.

### Panel: la plantilla visual del panel viejo

#### CA-22: Los mismos tokens [panel]
- **Dado** `src/lib/administrador/admin.css` de beenso (`d74d3fb`)
- **Cuando** se comparan sus variables (`--bg`, `--panel`, `--ink`, `--accent`, `--ok`, `--warn`, `--bad`, `--r`, `--shadow`, `--sans`, `--mono` y las demás) con las de la hoja global del panel
- **Entonces** están todas, con los mismos valores, en el tema claro y en el oscuro. Se comprueba con un `diff` de las dos listas de variables, y la hoja global dice en un comentario de qué archivo y de qué commit salen.
- **Y** la hoja global tiene solo tokens, reset y primitivas (botón, tarjeta, tabla, insignia). El resto de los estilos vive con su componente, y ninguna hoja pasa de 300 líneas.

#### CA-23: El mismo marco [panel]
- **Dado** una persona del equipo con sesión
- **Cuando** abre cualquier pantalla con sesión, también el inicio de M1
- **Entonces** ve el marco del panel viejo:
  - la barra lateral con la marca («ensō OS · Centro de control») y sus logos para tema claro y oscuro, servidos desde el panel;
  - el menú agrupado en «Administración» y «Negocio», con los íconos del panel viejo;
  - la barra superior con su nombre y el cambio de tema.
- **Y** el menú sale de la tabla de rutas: solo muestra lo que la persona puede usar (CA-25 de M1), en el orden del panel viejo.
- **Y** no aparece nada que M2a no tenga (ver «Fuera de alcance»).
- **Y** el marco vive en `app/shared/layout/`, con un componente por archivo, y `root.tsx` solo lo monta.
- **Y** las páginas públicas (el login y «sin acceso») usan los tokens, sin el marco.

#### CA-24: Las tipografías salen del propio panel [panel]
- **Dado** la CSP de M1 (`font-src 'self'` y `style-src 'self'`)
- **Cuando** carga cualquier página
- **Entonces** Inter Tight y JetBrains Mono se sirven desde los estáticos del panel, en `woff2` y solo con los pesos que se usan.
- **Y** la CSP no cambia, y ninguna página pide nada a `fonts.googleapis.com` ni a `fonts.gstatic.com`.

#### CA-25: El tema claro, el oscuro o el del sistema, sin parpadeo [panel]
- **Dado** una persona que eligió el tema oscuro
- **Cuando** recarga cualquier página
- **Entonces** la página se pinta oscura desde el primer cuadro: un script en el `<head>`, con el nonce de la CSP, pone `data-theme` antes de pintar.
- **Y** sin preferencia guardada manda el tema del sistema. También manda si el navegador no deja leer `localStorage`.
- **Y** la preferencia se guarda solo en el navegador, nunca en la sesión.

#### CA-26: Las pantallas tienen la forma de las del panel viejo [panel, manual]
- **Dado** las páginas del panel viejo `empresas/index.astro`, `empresas/[slug].astro`, `usuarios.astro` y `gobernanza.astro`
- **Cuando** se construyen Empresas, la ficha, Usuarios de clientes y Gobernanza
- **Entonces** cada una toma la disposición de su par (encabezado, tarjetas, tablas e insignias de estado), con los datos de la API nueva. Lo que depende de datos que M2a no tiene no se muestra.
- **Y** los íconos salen de `iconos.ts` del panel viejo, pasados a componentes.
- **Y** las páginas viejas de más de 300 líneas se parten en componentes dentro de los topes.
- **Y** Jose compara capturas de las dos versiones de cada pantalla y las aprueba.

### Panel: pantallas y datos

#### CA-27: El acceso `superadmin` en la tabla de rutas [panel]
- **Dado** `app/shared/routing/route-table.ts`
- **Cuando** una ruta declara `access: 'superadmin'`
- **Entonces** solo la abre una persona activa con `superadmin: true`. Las demás reciben la página de permiso negado y no ven la ruta en el menú.
- **Y** `tests/routes-declare-permission.test.ts` acepta el tipo nuevo y sigue fallando con una ruta que no declara su acceso.

#### CA-28: Las pantallas nuevas y su acceso [panel]
- **Dado** esta tabla:

| Ruta | Pantalla | Acceso | En el menú |
|---|---|---|---|
| `companies` | Empresas: la lista, con búsqueda y paginación | `companies: view` | Empresas |
| `client-users/checkup` | La revisión de datos (doctor) | `clientUsers: view` | no: se entra desde Usuarios de clientes |
| `companies/:companyId` | La ficha y su historia | `companies: view` | no |
| `client-users` | La lista de las personas de los clientes, y buscar una por su correo | `clientUsers: view` | Usuarios de clientes |
| `client-users/:companyId` | Las personas, los roles y la bitácora de una empresa | `clientUsers: view` | no |
| `governance` | La auditoría | `governance: view` | Gobernanza |
| `team` | Equipo ensō | `superadmin` | Equipo ensō |

- **Cuando** corren las pruebas de la tabla de rutas y de estructura
- **Entonces** cada ruta está declarada con ese acceso.
- **Y** cada pantalla vive en su módulo (`app/modules/<módulo>/`), con un componente por archivo y dentro de los topes del workspace, y `tests/structure.test.ts` sigue en verde.
- **Y** ninguna pantalla tiene un botón de guardar ni un formulario que cambie datos. Los únicos formularios son las búsquedas.

#### CA-29: El cliente de la API traduce en un solo lugar [panel]
- **Dado** respuestas grabadas de cada endpoint nuevo
- **Cuando** pasan por `app/shared/api/`
- **Entonces** el resto del panel recibe tipos del dominio en inglés: `Company`, `CompanyFile`, `ClientUser` y `AuditEvent`.
- **Y** ningún archivo fuera de `app/shared/api/` usa nombres del backend.
- **Y** un campo desconocido en una respuesta se ignora con un aviso en el log, como hace hoy `toTeamMember`, y la página no se rompe.

#### CA-30: Los errores del backend en una pantalla de módulo [panel]
- **Dado** una pantalla nueva
- **Cuando** el backend responde:
  - (a) 404;
  - (b) 403;
  - (c) 401;
  - (d) 5xx, 429 o nada
- **Entonces**:
  - (a) muestra «Esa empresa no existe o no está disponible»;
  - (b) muestra la página de permiso negado y no borra la sesión;
  - (c) borra la sesión y lleva a «sin acceso», igual que un rechazo de `/yo`;
  - (d) muestra un error con «Volver a intentar», sin tocar la sesión.

#### CA-31: La prueba rápida cubre las rutas nuevas [infra]
- **Dado** el smoke del panel (`npm run smoke`)
- **Cuando** corre después de desplegar M2a
- **Entonces**, además de lo de M1, comprueba que cada ruta nueva sin sesión redirige a `/auth/login`.

### Producción

#### CA-32: Prueba real con la empresa de pruebas [manual]
- **Dado** M2a desplegado con `AIOS_ADMIN_CLIENTES=desarrollo-enso-78479d`
- **Cuando** Jose entra al panel
- **Entonces**:
  - Empresas muestra solo Desarrollo Enso, con el aviso del filtro;
  - su ficha muestra el plan, los asientos y la historia;
  - Usuarios de clientes lista a las personas de Desarrollo Enso, encuentra un correo de Desarrollo Enso y no encuentra el de una persona de otra empresa;
  - las personas de Desarrollo Enso aparecen con su rol y su estado;
  - Gobernanza muestra los eventos del equipo, como el alta del superadministrador;
  - la revisión de datos responde y dice cuántos hallazgos quedan fuera;
  - Equipo ensō lista a las personas del equipo.

## Casos borde y de error

### CB-1: La empresa se borra mientras se mira
- **Dado** una ficha abierta en el panel
- **Cuando** la empresa se borra y se recarga la página
- **Entonces** el backend responde 404 y el panel muestra «Esa empresa no existe o no está disponible».

### CB-2: La lista de visibles nombra una empresa que no existe
- **Dado** `AIOS_ADMIN_CLIENTES` con un id que no está en la tabla
- **Cuando** se pide la lista de empresas
- **Entonces** responde 200 sin esa empresa y sin error.

### CB-3: Un cursor con otra búsqueda
- **Dado** un `siguiente` emitido para `?q=a`
- **Cuando** se usa con `?q=b`
- **Entonces** responde 422, porque el cursor solo vale para la búsqueda que lo emitió.

### CB-4: Una empresa sin asientos
- **Dado** una empresa visible sin asientos
- **Cuando** se piden su ficha y sus personas
- **Entonces** responden 200, con `admins: 0` y las listas vacías.

### CB-5: Una fila vieja o rara
- **Dado** una empresa con un `tier` que no existe o con `condiciones` ilegibles
- **Cuando** se pide la lista
- **Entonces** responde 200. Esa empresa sale con lo que se pudo leer, y las demás no se ven afectadas.

### CB-6: Faltan las dependencias publicadas
- **Dado** que no existe `acceso/dependencias.json` en el bucket de bundles
- **Cuando** se piden la ficha y las personas
- **Entonces**:
  - la ficha responde 200 con `acceso: null`;
  - las personas responden 503 con el mismo mensaje que `GET /v1/team/acceso`;
  - el log dice qué hay que publicar.

### CB-7: El correo llega con mayúsculas o espacios
- **Dado** el correo de una persona con asiento
- **Cuando** se busca con `  Persona@Empresa.COM `
- **Entonces** encuentra a la persona, porque el correo se normaliza con `correoNormalizado`.

### CB-8: La auditoría está vacía
- **Dado** que no hay eventos visibles
- **Cuando** se pide `GET /v1/admin/auditoria`
- **Entonces** responde 200 con `[]` y `siguiente: null`, y el panel dice «Todavía no hay eventos».

### CB-9: La API de admin frena por exceso de pedidos
- **Dado** que la API responde 429
- **Cuando** una pantalla carga
- **Entonces** el panel lo trata como (d) de CA-30: muestra el error con «Volver a intentar».

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-15, CA-16 | integración (synth sin cuenta ni red) | `tests/infra-equipo.test.js` (backend) |
| CA-2, CA-3 | unit + integración | `tests/admin-clientes-visibles.test.js` (backend, nuevo) |
| CA-4 | integración + unit | backend: los tests de cada endpoint de lista; panel: `tests/filter-notice.test.ts` (nuevo) |
| CA-5, CA-6, CA-7, CA-8, CB-2 a CB-5 | integración (handler con motores en memoria) | `tests/admin-clientes-endpoint.test.js` (backend, nuevo) |
| CA-9 | integración | `tests/admin-doctor-endpoint.test.js` (backend, nuevo) |
| CA-10, CA-11, CB-6, CB-7 | integración | `tests/admin-personas-endpoint.test.js` (backend, nuevo) |
| CA-33 | integración (backend) y unit (panel) | `tests/admin-personas-endpoint.test.js` y `tests/admin-clientes-visibles.test.js` (backend); `tests/client-users-list.test.ts`, `tests/client-users-filters.test.ts`, `tests/client-users-search.test.ts`, `tests/people-search-state.test.ts`, `tests/page-loading.test.ts` y `tests/admin-read-api.test.ts` (panel) |
| CA-12, CB-8 | integración | `tests/admin-auditoria-endpoint.test.js` (backend, nuevo) |
| CA-13 | integración | `tests/admin-equipo-endpoint.test.js` (backend, nuevo) |
| CA-14 | integración (tabla de casos) | `tests/admin-permisos-por-ruta.test.js` (backend, nuevo) |
| CA-17 | integración | `tests/dev-local-admin.test.js` (backend) |
| CA-18, CA-19 | integración | dentro de cada test de endpoint nuevo |
| CA-20 | inspección + suite | `package.json`, `npm test` |
| CA-21 | inspección | `git merge-base --is-ancestor` antes del deploy |
| CA-22 | inspección | `diff` de las variables de `admin.css` de beenso contra la hoja global del panel |
| CA-23 | unit (render del marco con una persona falsa) | `tests/app-shell.test.ts` (panel, nuevo) |
| CA-24 | unit (sobre el build) | `tests/fonts.test.ts` (panel, nuevo), `tests/security-headers.test.ts` |
| CA-25 | unit (render del `<head>`) | `tests/theme.test.ts` (panel, nuevo) |
| CA-26 | manual | capturas lado a lado del panel viejo y el nuevo |
| CA-27, CA-28 | unit | `tests/routes-declare-permission.test.ts`, `tests/route-access.test.ts`, `tests/structure.test.ts` (panel) |
| CA-29 | unit | `tests/admin-api-companies.test.ts`, `tests/admin-api-client-users.test.ts` (panel, nuevos) |
| CA-30, CB-1, CB-9 | integración (loader con la API falsa) | `tests/module-errors.test.ts` (panel, nuevo) |
| CA-31 | e2e | `npm run smoke` (panel) |
| CA-32 | manual | producción, con la empresa de pruebas |

## Archivos probablemente afectados

**[backend] `aios-backend`**
- `src/lib/admin/clientes-visibles.js` (nuevo): el filtro, en una sola función.
- `src/lib/admin/vistas-de-clientes.js` (nuevo): las listas blancas de la empresa, la ficha y la historia, más la paginación.
- `src/lib/admin/auditoria.js` (nuevo): la lectura paginada de `eventos`, con el filtro.
- `src/handlers/admin-*.js` (nuevos): un handler por ruta, de 30 líneas o menos.
- `src/lambda.js`: `RUTAS_ADMIN` y sus exports.
- `infra/equipo.js`: las rutas, las funciones, los permisos y `AIOS_ADMIN_CLIENTES`.
- `infra/app.js`: lee `AIOS_ADMIN_CLIENTES`.
- `infra/aios-stack.js`: le pasa a `montarEquipo` la tabla `tenants` y el bucket de bundles.
- `local.settings.sample.json`: la variable nueva.
- `package.json`: los tests nuevos.
- Los tests nombrados en el plan de pruebas.

**[panel] `aios-admin`**
- `app/shared/routing/route-table.ts` y `route-access.ts`: el acceso `superadmin` y las rutas nuevas.
- `app/domain/`: los tipos `Company`, `CompanyFile`, `ClientUser` y `AuditEvent`.
- `app/shared/api/`: los métodos nuevos y su traducción, uno o dos archivos por recurso.
- `app/shared/layout/`: el marco (barra lateral, barra superior, cambio de tema), el aviso del filtro y la página de error de módulo, que usan varios módulos.
- `app/shared/icons/` (nuevo): los íconos de `iconos.ts`, como componentes.
- `app/styles/` (nuevo): la hoja global, con los tokens, el reset y las primitivas.
- `app/root.tsx`: monta el marco y el script del tema.
- `public/fonts/` y `public/brand/` (nuevos): las tipografías y los logos.
- `app/modules/companies/`, `app/modules/client-users/`, `app/modules/governance/` y `app/modules/team/` (nuevos).
- `infra/`: el smoke.
- Los tests nombrados en el plan de pruebas.

## Riesgos y preguntas abiertas

- **Gobernanza sin filtro recorre la tabla `eventos` entera (Scan).** Con el volumen de hoy cuesta nada. Si pasa de unos miles de eventos, hace falta un índice por fecha.
- **El estado de Cognito de una persona de un cliente queda fuera.** Sería útil para soporte (por ejemplo, una cuenta que nunca confirmó el correo), pero exige decidir si la API de admin puede leer el pool de clientes.
- **Falta definir la revisión de seguridad:** quién la hace, con qué alcance y qué la da por aprobada. Levantar el filtro es desplegar con `AIOS_ADMIN_CLIENTES=todos`; el catálogo privado entra después, en M2b.
