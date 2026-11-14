# Spec: Cuentas personales en el superadmin

- **Fecha:** 2026-10-30
- **Origen:** idea interna (Jose). Tuvo que crear una empresa por cada una de las 381 personas del webinar del 2026-10-28, y Empresas mezcla los clientes reales con ellas. Plan aprobado el 2026-10-30. El mockup está en `docs/2026-10-30-mockup-cuentas-personales.html` (raíz del workspace).
- **Estado:** borrador
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en la rama `superadmin_v2`.

## Objetivo

El sistema distingue una **cuenta personal** de una **empresa**, sin cambiar cómo entra nadie ni qué recibe. Una cuenta personal es la de una persona sola: alguien que compró Pro, o cada persona del webinar. En el panel, Empresas muestra solo los clientes reales, y las cuentas personales van en su propia pestaña. Las dos pestañas se buscan y se filtran por plan igual que hoy se filtra Usuarios de clientes.

## Alcance

- **Backend:**
  - el campo `tipo` en la ficha del cliente (la fila `tenant`), que vale `'personal'` o no está; si no está, la cuenta es una empresa;
  - quién pone el campo al crear la cuenta y cuándo se quita;
  - el evento nuevo `tipo-de-cuenta` en la historia de la cuenta;
  - el tipo en las respuestas de la API de administración;
  - en la lista de cuentas: el filtro por tipo, el filtro por plan y los conteos;
  - la búsqueda de cuentas por POST;
  - un comando de migración para marcar las cuentas que ya existen.
- **Panel:**
  - las pestañas de Empresas;
  - los filtros automáticos, con búsqueda y plan, en las dos pestañas;
  - la tabla y la ficha de una cuenta personal;
  - en Usuarios de clientes, la etiqueta «Cuenta personal» y la opción nueva del filtro;
  - el buscador y la búsqueda por detrás, pasados a `shared/` para que las dos pantallas usen los mismos.

## Fuera de alcance

- **La regla «la empresa gana a la cuenta personal».** Invitar a una empresa un correo que ya tiene cuenta personal sigue fallando con 409 `correo-no-disponible`. Va en su propia spec.
- **Una persona en varias empresas.**
- **Ponerle fecha de fin al acceso del webinar.**
- **Cambiar el tipo a mano desde el panel.** Las escrituras del panel son de M2b.
- **Renombrar las cuentas existentes.** El alta en lote reconoce cada cuenta por su nombre para poder retomarse (`src/lib/alta-en-lote.js`); si se renombran, vuelve a crearlas.
- **El filtro de plan en Usuarios de clientes.**
- **ENSŌ.** El manifest no lleva el tipo, y nada de la app cambia.

## Criterios de aceptación

### Backend: el campo y el alta

### CA-1: Sin el campo, es empresa
- **Dado** una ficha de cliente sin `tipo`, o con un valor distinto de `'personal'`
- **Cuando** cualquier parte del backend pregunta su tipo
- **Entonces** la respuesta es `'empresa'`. Lo decide una sola función, y todos los llamadores usan esa.

### CA-2: Una compra de Pro en la web crea una cuenta personal
- **Dado** un evento de compra de Stripe con un plan de un solo asiento (Pro)
- **Cuando** el webhook crea el cliente (`src/lib/webhooks.js`, el alta por compra)
- **Entonces** la ficha nueva tiene `tipo: 'personal'`, y el evento `alta` de su historia lleva `tipo: 'personal'` en el detalle.

### CA-3: Una compra de Team crea una empresa
- **Dado** un evento de compra con un plan de más de un asiento (Team)
- **Cuando** el webhook crea el cliente
- **Entonces** la ficha nueva no tiene `tipo`, y el evento `alta` lleva `tipo: 'empresa'`.

### CA-4: El alta en lote crea cuentas personales
- **Dado** una lista válida para `npm run alta-en-lote`
- **Cuando** se aplica
- **Entonces** cada cuenta creada tiene `tipo: 'personal'`. Si se corre otra vez, no duplica a nadie ni cambia el tipo de las cuentas que ya existen.

### CA-5: `tenant create` crea empresas, salvo que se pida otra cosa
- **Dado** `npm run tenant -- create --name … --preset … --tier …`
- **Cuando** se corre sin `--personal`
- **Entonces** la ficha no tiene `tipo`. Con `--personal`, tiene `tipo: 'personal'`.

### CA-6: `crearTenant` rechaza un tipo desconocido
- **Dado** una llamada a `crearTenant` (`src/lib/alta.js`) con un `tipo` que no es `'personal'` ni `'empresa'`
- **Cuando** se ejecuta
- **Entonces** lanza `TypeError` antes de escribir ninguna fila.

### Backend: cuándo deja de ser personal

### CA-7: Una cuenta personal que pasa a tener equipo se vuelve empresa
- **Dado** una cuenta con `tipo: 'personal'`
- **Cuando** cambia a un plan con más de un asiento, o sin tope de asientos, por cualquiera de estos caminos:
  - un evento de Stripe con estado y con precio de Team;
  - un evento sin estado que declara el plan Team;
  - `npm run tenant -- set-tier --tier team`;
  - un Personalizado con `asientos` mayor que 1.
- **Entonces**:
  - la ficha queda sin `tipo`, en la misma escritura que el cambio de plan;
  - la historia anota `tipo-de-cuenta` con `{ de: 'personal', a: 'empresa' }`.

  Los asientos que cuentan son los del plan, aunque esté vencido. La regla vive en una sola función, por la que pasan todos los cambios de plan (`modificarPlan`, en `src/lib/entitlements.js`).

### CA-8: Una empresa nunca se vuelve personal sola
- **Dado** una empresa
- **Cuando** baja a Pro o a Free, o su plan vence
- **Entonces** sigue sin `tipo`, y no se anota `tipo-de-cuenta`.

### CA-9: Los cambios que no son de plan conservan el tipo
- **Dado** una cuenta personal
- **Cuando** pasa cualquiera de estas cosas:
  - llega un pago confirmado, un pago fallido o una cancelación;
  - se rota su credencial;
  - se descarta su Personalizado y pasa a un plan de un asiento.
- **Entonces** sigue con `tipo: 'personal'`.

### Backend: la API de administración

### CA-10: La lista de cuentas filtra por tipo y por plan
- **Dado** `GET /v1/admin/clientes`
- **Cuando** se pide con estos parámetros:
  - `?tipo=empresa`: solo las cuentas sin `tipo`;
  - `?tipo=personal`: solo las cuentas personales;
  - sin `tipo`: todas, como hoy, para que el panel desplegado siga igual mientras se despliega el nuevo;
  - `?plan=free|pro|team|personalizado`: solo las cuentas con ese plan contratado (el mismo que muestra la columna Plan); se puede combinar con `tipo`.
- **Entonces**:
  - cada elemento trae `tipo`;
  - la respuesta trae `conteo: { empresas: { total, planes }, personales: { total, planes } }`, donde `planes` tiene cuántas cuentas hay de cada plan (`{ free, pro, team, personalizado }`);
  - el conteo cuenta las cuentas visibles para el filtro de clientes (`AIOS_ADMIN_CLIENTES`) y no depende de la búsqueda, del plan elegido ni de la página.

### CA-11: La lista de cuentas personales trae a su persona
- **Dado** `GET /v1/admin/clientes?tipo=personal`
- **Cuando** responde
- **Entonces**:
  - cada elemento trae `persona: { correo, estado, invitadoEl, aceptadoEl }`, que sale de su asiento vigente, o `null` si no tiene;
  - la lista va ordenada por ese correo, y las cuentas sin persona van al final, ordenadas por id;
  - el cursor lleva una posición, nunca un correo, igual que en `GET /v1/admin/personas`.

### CA-12: Buscar cuentas por POST
- **Dado** `POST /v1/admin/clientes/buscar` con `{ texto, tipo?, plan? }`, que exige el permiso de ver Empresas
- **Cuando** responde
- **Entonces**:
  - una empresa coincide si su nombre (sin tildes ni mayúsculas) o su id contienen el texto;
  - una cuenta personal coincide si el correo de su persona (sin mayúsculas) o su id contienen el texto;
  - `tipo` y `plan` filtran igual que en CA-10;
  - devuelve `{ clientes, hayMas, soloAlgunas }`, con hasta 100 cuentas en el mismo orden que la lista y con la misma forma (con `persona` en las personales);
  - el texto nunca se guarda en los registros.

### CA-13: La ficha dice el tipo
- **Dado** `GET /v1/admin/clientes/{id}` de una cuenta visible
- **Cuando** responde
- **Entonces** trae `tipo`. Si la cuenta es personal, trae también `persona`, con la misma forma que en CA-11.

### CA-14: Las personas dicen de qué tipo es su cuenta
- **Dado** `GET /v1/admin/personas` o `POST /v1/admin/personas/buscar`
- **Cuando** responden
- **Entonces**:
  - la `empresa` de cada persona trae `tipo`;
  - cada opción de `empresas`, la lista que llena la lista desplegable del filtro, trae `tipo`;
  - esa lista sigue trayendo todas las cuentas, para que el panel desplegado no cambie.

### CA-15: Filtrar personas por tipo
- **Dado** `GET /v1/admin/personas?tipo=personal`, o `POST /v1/admin/personas/buscar` con `{ texto, tipo: 'personal' }`
- **Cuando** responden
- **Entonces** traen solo a las personas de cuentas personales. Con `tipo=empresa`, traen solo a las de empresas.

### Backend: la migración

### CA-16: El comando de migración muestra antes de escribir
- **Dado** `npm run cuentas-personales -- --prefijo webinar-20261028- [--ids <id>,<id>]`
- **Cuando** se corre sin `--si`
- **Entonces**:
  - dice dónde escribiría, igual que los demás comandos (`dondeEstoyEscribiendo`);
  - lista las cuentas que marcaría, las que ya eran personales y las que rechaza, cada una con su motivo;
  - lista aparte las **candidatas**: cuentas sin `tipo`, de un solo asiento y con cliente de Stripe (las compras de Pro) que no están pedidas;
  - no escribe nada.

### CA-17: El comando marca solo lo pedido
- **Dado** el mismo comando con `--motivo "…" --si`
- **Cuando** se corre
- **Entonces**:
  - marca con `tipo: 'personal'` solo las cuentas cuyo id empieza con el prefijo o está en `--ids`;
  - escribe solo ese campo, con el control de versión de la fila (`modificarCliente`);
  - anota `tipo-de-cuenta` con `{ de: 'empresa', a: 'personal' }`, con quién lo corrió y el motivo;
  - si se corre otra vez, no cambia nada ni anota nada.

### Panel: Empresas

### CA-18: Empresas tiene dos pestañas
- **Dado** una persona del equipo con permiso para ver Empresas
- **Cuando** abre `/companies`
- **Entonces**:
  - ve las pestañas «Empresas (N)» y «Cuentas personales (M)», con los totales de `conteo`;
  - la pestaña «Empresas» se abre por defecto y pide `tipo=empresa`;
  - la pestaña «Cuentas personales» está en `/companies?kind=personal`, y esa dirección se puede compartir y recargar;
  - al cambiar de pestaña se borran la búsqueda (también de la dirección) y el plan elegido.

### CA-19: Los filtros se aplican solos, como en Usuarios de clientes
- **Dado** cualquiera de las dos pestañas
- **Cuando** la persona usa la barra de filtros
- **Entonces** la barra funciona igual que la de Usuarios de clientes:
  - **No tiene botón de buscar.** El texto se busca solo, 500 ms después de la última tecla, por POST (CA-12), y la lista cambia sin cambiar de pantalla.
  - **La búsqueda queda en la dirección, después de `#`.** Ejemplo: `/companies?kind=personal&plan=pro#buscar=maria`. La dirección se actualiza cuando se lanza la búsqueda y reemplaza la entrada actual del historial, sin agregar una por tecla.
  - **El navegador nunca manda al servidor lo que va después de `#`**, así que el texto no llega al panel ni a los registros de AWS. Al panel le llega solo por el cuerpo del POST.
  - **Una dirección con `#buscar=` se abre con la búsqueda hecha.** Al abrir un enlace así o al recargar, el buscador se llena con ese texto y la búsqueda se lanza sola.
  - **Una X dentro del buscador borra el texto**, también de la dirección, y devuelve el foco al buscador.
  - **Mientras hay texto, los resultados ocupan el lugar de la lista y de las páginas.** Se muestran hasta 100 resultados; si hay más, se avisa que hay que escribir más.
  - **Una respuesta vieja no se muestra**: si cambió el texto, el plan o la pestaña, la respuesta anterior se descarta.
  - **El texto de ayuda del buscador depende de la pestaña:** «Buscar por nombre o id» en Empresas, y «Buscar por correo» en Cuentas personales.

### CA-20: El filtro de plan
- **Dado** cualquiera de las dos pestañas
- **Cuando** la persona elige un plan en la lista desplegable
- **Entonces**:
  - la lista se filtra al momento, sin botón, y el plan va en la dirección (`?plan=pro`);
  - las opciones son «Todos los planes» y, después, cada plan con cuentas en esa pestaña, con su número: «Pro (12)», según `conteo`;
  - la lista desplegable se marca como filtro puesto, igual que la de empresa en Usuarios de clientes;
  - el plan también filtra la búsqueda por texto;
  - el botón «Borrar filtros» aparece cuando hay texto o plan, y borra los dos, pero no cambia de pestaña.

### CA-20b: Enmienda: la pestaña de cuentas personales lista por el índice, sin filtro ni números por plan
- **Enmienda:** desde el registro abierto (CA-24 de `aios-tower/specs/2026-11-12-registro-abierto.md`), la pestaña «Cuentas personales» lista por el índice de cuentas (`GET /v1/admin/cuentas?tipo=personal`), de la más nueva a la más vieja y por cursor, y cuenta por origen: registro, código, compra en la web, webinar y alta del equipo (CA-23 de esa spec). **No tiene filtro ni números por plan:** la lista por el índice no filtra por plan, y contar por plan obligaría a leer todas las cuentas personales en cada página, que es justo lo que evita CA-24.
- **Reemplaza, solo en esa pestaña:** el filtro de plan de CA-20 y sus números; los totales de las pestañas de CA-18, que ahí salen de los contadores del índice y no de `conteo`; y de CA-21, la columna Origen, que sale de `nacidaDe`, y las páginas, que van por cursor. La pestaña Empresas sigue como dicen CA-18 a CA-20.
- **Por lo mismo:** en `GET /v1/admin/clientes?tipo=empresa`, después del relleno del índice, `conteo.personales.planes` llega en `null` (CA-10), y el panel lo lee como «sin dato», nunca como ceros. Antes del relleno (CA-44 de esa spec), la pestaña dice «sin contar todavía» en lugar de sus números.
- **Pendiente de una decisión de Jose (J-25):** contadores por plan que se muevan con cada cambio de plan (webhooks, panel, vencimientos), o un conteo diario por plan en el backend, con hasta un día de atraso. Hasta que decida, ninguna pantalla del panel dice cuántas cuentas personales hay de cada plan.
- **Origen:** la construcción del índice de cuentas (pieza RP1 de la fase R del plan de créditos) y su revisión, 2026-11-14.

### CA-21: La tabla de cuentas personales
- **Dado** la pestaña «Cuentas personales»
- **Cuando** carga
- **Entonces** muestra estas columnas:
  - **Persona:** el correo, o «Sin persona» si no tiene;
  - **Plan**, **Estado** y **Vence:** con las mismas etiquetas que en Empresas;
  - **Origen:** «Compra en la web» si paga por Stripe, «Alta del equipo» si no;
  - **Entró:** la fecha de `aceptadoEl`, o «Todavía no»;
  - **Abrir.**

  Las páginas funcionan como en Empresas.

### CA-22: La ficha de una cuenta personal
- **Dado** `/companies/{id}` de una cuenta personal
- **Cuando** carga
- **Entonces**:
  - el título es el correo de su persona, o el id si no tiene;
  - el camino de migas es «Empresas › Cuentas personales › <correo>»;
  - la ficha lleva la etiqueta «Cuenta personal»;
  - la tarjeta del plan no muestra asientos ni admins;
  - una tarjeta «Persona» muestra el correo, el estado, la fecha de invitación y la fecha en que aceptó;
  - las tarjetas de acceso y de historia son las de hoy;
  - no aparece el botón «Ver sus personas».

  La ficha de una empresa no cambia.

### Panel: Usuarios de clientes

### CA-23: Usuarios de clientes nombra las cuentas personales
- **Dado** la lista o la búsqueda de Usuarios de clientes
- **Cuando** una persona es de una cuenta personal
- **Entonces** la columna Empresa dice «Cuenta personal», en lugar del nombre de la cuenta, con un enlace a sus personas como el resto de las filas. La ficha de la cuenta no sirve de destino: exige el permiso de Empresas, que alguien de Usuarios puede no tener.

### CA-24: La lista desplegable separa las cuentas personales
- **Dado** el filtro de empresa de Usuarios de clientes
- **Cuando** se abre
- **Entonces**:
  - trae, en este orden: «Todas las empresas», «Solo cuentas personales (M)» y el grupo «Empresas (N)», con las empresas por nombre;
  - ninguna cuenta personal aparece como opción propia;
  - elegir «Solo cuentas personales» lleva a `?kind=personal`, y la lista y la búsqueda piden `tipo=personal`;
  - «Borrar filtros» también quita esa opción.

### CA-25: Las dos pantallas comparten el buscador
- **Dado** el buscador con su X y la búsqueda que espera a que se deje de escribir
- **Cuando** se construye este cambio
- **Entonces**:
  - los dos viven en `app/shared/`, y tanto Usuarios de clientes como Empresas los usan desde ahí;
  - Usuarios de clientes se comporta igual que antes, con un solo cambio: su búsqueda también queda en la dirección después de `#` (CA-19), así que ya no se borra al recargar;
  - sus pruebas siguen pasando sin cambiar lo que comprueban, salvo la que dice que la búsqueda no cambia la dirección.

## Casos borde y de error

### CB-1: Un tipo o un plan inválido en la API
- **Dado** un `tipo` o un `plan` que no está en la lista, en cualquiera de las rutas de CA-10 a CA-15
- **Cuando** llega el pedido
- **Entonces** la API responde 422, con un mensaje en español.

### CB-2: El texto de la búsqueda de cuentas
- **Dado** `POST /v1/admin/clientes/buscar`
- **Cuando** llega sin texto, con un texto de más de 254 caracteres o con un cuerpo que no es JSON
- **Entonces** responde 422. Con un cuerpo de más de 16 KB, responde 413. Es el mismo trato que la búsqueda de personas.

### CB-3: `q` en la lista de cuentas personales
- **Dado** `GET /v1/admin/clientes?tipo=personal&q=…`
- **Cuando** llega
- **Entonces** responde 422, y el mensaje dice que para buscar se usa el POST. Así, un correo nunca termina en una URL.

### CB-4: Tipo y empresa a la vez
- **Dado** `tipo` y `empresa` juntos en la lista o en la búsqueda de personas
- **Cuando** llegan
- **Entonces** responde 422.

### CB-5: Un cursor de otra pestaña o de otro plan
- **Dado** un cursor emitido con un `tipo` o un `plan`
- **Cuando** se usa con otro `tipo` u otro `plan`
- **Entonces** responde 422 con «el cursor es de otra búsqueda», como hoy pasa entre búsquedas.

### CB-6: Un plan desconocido en la dirección del panel
- **Dado** `/companies?plan=algo-que-no-existe`
- **Cuando** carga
- **Entonces** el panel no lo manda al backend: la lista sale sin filtro de plan, y la lista desplegable muestra «Todos los planes».

### CB-7: Una búsqueda inválida en la dirección
- **Dado** una dirección con `#buscar=` vacío, con más de 254 caracteres o con otras claves después del `#`
- **Cuando** carga cualquiera de las tres pantallas
- **Entonces** lo que no es válido se ignora: el buscador queda vacío y se muestra la lista. La página no falla.

### CB-8: El servidor nunca ve la búsqueda
- **Dado** una búsqueda en cualquiera de las tres pantallas
- **Cuando** se mira cada pedido al servidor del panel
- **Entonces** el texto viaja solo en el cuerpo del POST: ni en la dirección del pedido ni en el `loader`.

### CB-9: Una ficha con un plan raro
- **Dado** una cuenta cuyo `tier` no es ninguno de los cuatro planes
- **Cuando** se cuenta
- **Entonces** suma en `total`, pero en ningún plan de `planes`. La respuesta no falla.

### CB-10: Una cuenta personal con más de una entrada en el índice
- **Dado** una cuenta personal con dos correos vigentes, un dato raro que no debería existir
- **Cuando** se lista, se busca o se abre su ficha
- **Entonces** `persona` es la del correo que va primero en orden alfabético, y la respuesta no falla. La búsqueda la encuentra por cualquiera de los dos correos.

### CB-11: Las cuentas fuera del filtro no se cuentan
- **Dado** `AIOS_ADMIN_CLIENTES` con una lista de clientes
- **Cuando** se pide la lista, la búsqueda, el conteo o la ficha
- **Entonces** las cuentas que no están en la lista no aparecen ni se cuentan, sean del tipo que sean. La ficha de una de ellas responde 404, como hoy.

### CB-12: La migración no acepta un prefijo vacío ni corto
- **Dado** `--prefijo ""` o un prefijo de menos de 8 caracteres
- **Cuando** se corre el comando
- **Entonces** falla sin leer nada. Un prefijo corto podría marcar por error a cuentas reales.

### CB-13: La migración no marca una cuenta con equipo
- **Dado** una cuenta pedida cuyo plan tiene más de un asiento, o que tiene más de un asiento vigente
- **Cuando** se corre el comando
- **Entonces** la rechaza, con su motivo, y sigue con las demás.

### CB-14: La migración choca con un webhook
- **Dado** un evento de Stripe que escribe en la misma cuenta mientras corre la migración
- **Cuando** las dos escriben
- **Entonces** ninguna pisa a la otra: la que llega segunda vuelve a leer la fila y aplica su cambio encima (el control de versión de `modificarCliente`).

### CB-15: El manifest no cambia
- **Dado** una cuenta que pasa de empresa a personal, o al revés
- **Cuando** ENSŌ pide `/v1/manifest`
- **Entonces** el cuerpo y el ETag son los mismos de antes, byte por byte.

### CB-16: El evento nuevo está declarado
- **Dado** la lista cerrada de eventos (`EVENTOS`, en `src/lib/bitacora-de-cliente.js`)
- **Cuando** se anota `tipo-de-cuenta`
- **Entonces** el evento se guarda y se puede leer en la historia de la cuenta.

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1 a CA-9, CB-15 | integration (webhook con firma simulada, comandos de plan, motores en memoria) | `tests/tipo-de-cuenta.test.js` (backend) |
| CA-10 a CA-15, CB-1 a CB-5, CB-9 a CB-11 | integration (handlers con motores en memoria) | `tests/admin-cuentas-personales.test.js` |
| CA-16, CA-17, CB-12 a CB-14, CB-16 | integration | `tests/cuentas-personales.test.js` |
| La ruta nueva: su función, su permiso y la cuenta escondida | unit (síntesis de CDK) e integration | `tests/infra-equipo.test.js`, `tests/admin-permisos-por-ruta.test.js`, `tests/admin-clientes-visibles.test.js` |
| CA-18, CA-20, CA-21, CB-6, CB-8 | integration (loader con una API falsa) | `tests/companies-list.test.ts` (panel) |
| CA-19 | integration (acción con una API falsa) | `tests/companies-search.test.ts` |
| CA-18 a CA-20 | render | `tests/companies-filters.test.ts` |
| CA-21 a CA-23 | render | `tests/personal-accounts.test.ts` |
| CA-19, CA-25, CB-7 | unit | `tests/background-search.test.ts` |
| CA-24 | render e integration | `tests/client-users-filters.test.ts`, `tests/client-users-list.test.ts`, `tests/client-users-search.test.ts` |
| La traducción de los nombres del backend | unit | `tests/admin-read-api.test.ts` |
| CA-5 por el comando | manual | `--personal` no corre en la suite: el comando habla con el almacén real. La regla está probada en `crearTenant` |
| CA-17 en producción | manual | Jose corre el comando sin `--si` y revisa la lista con Claude; después lo corre con `--si`. Al final, la pestaña Empresas tiene que mostrar 15 |

## Archivos probablemente afectados

**Backend (`aios-backend-superadmin`):**
- `src/lib/tipo-de-cuenta.js` (nuevo): la función que dice el tipo y la que decide si una cuenta deja de ser personal.
- `src/lib/alta.js`: `crearTenant` recibe y valida el tipo (una cuenta personal no nace con un plan de equipo) y lo pone en el evento `alta`.
- `src/lib/plan-efectivo.js`: `asientosDelContrato`, los asientos del plan sin mirar si venció.
- `src/lib/entitlements.js`: `modificarPlan` aplica la regla de CA-7.
- `src/lib/webhooks.js`, `src/lib/alta-en-lote.js` y `scripts/tenant.js`: con qué tipo nace cada cuenta.
- `src/lib/bitacora-de-cliente.js`: el evento `tipo-de-cuenta`.
- `src/lib/asientos.js`: la constante `ESTADO_REVOCADO`.
- `src/lib/admin/filtros.js` (nuevo): el tipo, el plan y el texto de una búsqueda.
- `src/lib/admin/vistas-de-clientes.js`: `tipo`, `plan`, `conteo` y `persona`, el orden por correo y la búsqueda de cuentas.
- `src/lib/admin/personas-de-clientes.js`: el tipo en cada persona y en las opciones, y el filtro por tipo.
- `src/lib/admin/paginacion.js` (`paginarPorPosicion`) y `src/lib/admin/rutas-de-lectura.js` (`cuerpoDeBusqueda`): lo que ahora comparten dos listas y dos búsquedas.
- `src/handlers/admin-clientes.js`, `admin-personas.js`, `admin-buscar-persona.js` y `admin-buscar-cliente.js` (nuevo).
- `src/lambda.js` e `infra/equipo.js`: la ruta nueva y su función de lectura.
- `src/lib/cuentas-personales.js` y `scripts/cuentas-personales.mjs` (nuevos), y su entrada en `package.json`.

**Panel (`aios-admin`):**
- `app/domain/companies.ts` y `app/domain/client-users.ts`: el tipo de cuenta, la persona, los conteos y la búsqueda de cuentas.
- `app/shared/api/`: la traducción de los campos nuevos y `searchCompanies`.
- `app/shared/search/use-background-search.ts` (nuevo, en lugar de `modules/client-users/use-people-search.ts`): la búsqueda por detrás y el `#buscar=`.
- `app/shared/ui/search-input.tsx` (nuevo) y `app/shared/labels/seat-status-labels.ts` (movido desde `client-users`).
- `app/modules/companies/`: la ruta con pestañas, filtros y búsqueda; `company-tabs`, `companies-filters`, `personal-accounts-table`, `companies-search-results` y `company-person-card` (nuevos); la ficha y la tarjeta del plan.
- `app/modules/client-users/`: la barra de filtros, la tabla, los resultados y la ruta.

**No cambian:** ENSŌ y el manifest.

## Riesgos y preguntas abiertas

- **Decidido por Jose el 2026-10-30: el permiso de Empresas ve el correo de la persona de una cuenta personal.** Es una excepción a la regla de que los correos de los clientes son del módulo de Usuarios: en una cuenta personal el correo es su nombre, y sin él la pestaña sería una lista de ids. Solo se ve el correo de esa persona, nunca el equipo de una empresa.

- **La búsqueda va en la dirección después de `#`, no en `?q=`.** No llega a los registros de AWS, pero queda en el historial del navegador de quien busca, y en el enlace si lo comparte: un correo buscado va en el mensaje donde se pegue el enlace. Un enlace viejo con `?q=` abre la lista sin búsqueda. `GET /v1/admin/clientes?q=` sigue funcionando para el panel ya desplegado.
- **El despliegue del backend crea una función de Lambda y una ruta nuevas** (`POST /v1/admin/clientes/buscar`). El `infra:diff` las tiene que mostrar, y nada más.
- **Una empresa que compra Pro en la web queda como cuenta personal.** Al comprar no hay forma de distinguirla. Pasa a empresa sola cuando sube a Team; si hiciera falta antes, se corrige a mano en M2b.
- **Las candidatas de la migración se confirman una por una.** Una compra de Pro puede ser de una empresa real, así que solo se marcan las que Jose pase por `--ids`.
- **Diferencia con el mockup:** el mockup tenía «Origen» y «Pago» en columnas separadas. Las dos dicen lo mismo (si la cuenta paga por Stripe), así que quedan en una sola columna, «Origen».
- **Diferencia con el mockup:** la ficha de María muestra «Ahora entra a Auteco» y el evento «pasó a una empresa». Eso es parte de la regla «la empresa gana a la cuenta personal», que queda fuera de esta spec.
- **Orden del despliegue:** primero el backend, después la migración y al final el panel. Desplegar solo el backend no cambia nada visible: sin `tipo`, CA-10 y CA-14 devuelven todo.
