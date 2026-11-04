# Spec: Crear empresas e invitar personas desde el superadmin (primera parte de M2b)

- **Fecha:** 2026-11-04
- **Origen:** pedido de Jose («necesito poder crear empresas y usuarios a través del superadministrador»). Está en el plan del superadmin (`docs/2026-10-20-plan-superadmin-aws.md`, §7.1: `POST /clientes` y `POST /clientes/{id}/personas`), y la spec de M2a lo dejó para M2b.
- **Estado:** aprobada (Jose, 2026-11-04)
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en la rama `superadmin_v2`.

## Objetivo

El equipo de ENSŌ crea empresas y cuentas personales e invita personas desde el panel, sin la consola. Hoy todo eso es `npm run tenant -- create`, `npm run tenant -- personalizar`, `npm run alta-en-lote` y, para mover a alguien que venía del webinar, `npm run eliminar-usuarios` más una invitación a mano.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **El panel no muestra la license key.** La cuenta se crea con su credencial, igual que el alta en lote, pero la llave nunca sale del backend: cada persona entra a ENSŌ con su correo. | Jose, 2026-11-03 |
| 2 | **Qué se llena al crear:** nombre; tipo (lo pone la pestaña); plan **Personalizado** o **Free**; correo del admin, obligatorio. En Personalizado, todo lo del plan: contenido, asientos, equipo, horarios, fecha de fin y cupos. Pro y Team no se ofrecen: necesitan una suscripción de Stripe y se compran en la web. El precio propio de Stripe y «suscripción cancelada» quedan en la consola. | Jose, 2026-11-03 |
| 5 | **El paquete a medida no se elige al crear.** Es de un cliente concreto (hoy, el de Auteco): ofrecerlo en el formulario permitiría darle por error a otra empresa las skills de ese cliente. Una cuenta nueva recibe siempre el contenido estándar. Atar cada paquete a su empresa, sin que nadie lo elija, es su propia spec. | Jose, 2026-11-04 |
| 3 | **La empresa gana a la cuenta personal.** Si el correo que se invita tiene una cuenta personal que no paga por Stripe, el panel avisa y, si se confirma, borra esa cuenta e invita a la persona, en un solo paso. Si la cuenta personal paga por Stripe, se bloquea. Si el correo es de otra empresa, se bloquea siempre. | Jose, 2026-11-04 |
| 4 | **Motivo obligatorio** al crear, invitar y mover, con su entrada en la auditoría. | Decisión 4 del plan (2026-10-27) |
| F | **Cada persona que invita el equipo recibe su correo de invitación**, como desde «Mi equipo», y el texto dice «el equipo de ENSŌ». | Decisión F del plan |
| 10 | **Crear e invitar piden el nivel «editar»** del módulo. **Mover desde una cuenta personal borra una cuenta**, así que es del superadministrador y pide un MFA reciente (opción B: `auth_time` de menos de 15 min). | Decisión 10 y opción B del plan |

## Alcance

- **Backend:**
  - `POST /v1/admin/clientes`: crear una empresa o una cuenta personal;
  - `POST /v1/admin/clientes/{id}/personas`: invitar a una persona a una cuenta;
  - mover desde una cuenta personal, dentro de las dos primeras.
- **Panel:**
  - «Nueva empresa» y «Nueva cuenta personal» en Empresas, con su formulario;
  - «Invitar persona» en la página de personas de una cuenta;
  - la confirmación de mover desde una cuenta personal.

## Fuera de alcance

- **Cambiar el plan de una cuenta que ya existe** (`PUT /clientes/{id}/personalizado`). Es la siguiente parte de M2b.
- **Cambiar de rol, revocar, los roles y el acceso por persona.**
- **Suspender o borrar una cuenta desde el panel**, salvo el borrado que hace mover (decisión 3).
- **Reenviar una invitación.**
- **Pro y Team**, el precio propio de Stripe y «suscripción cancelada» (decisión 2).
- **Altas en lote desde el panel.** Siguen con `npm run alta-en-lote`.
- **Altas y permisos del equipo ENSŌ** (Equipo ensō).

## Antes de empezar

- **La prueba previa de la opción B** (plan §3.3): comprobar que un inicio silencioso con la sesión de Cognito abierta no renueva `auth_time` sin pedir el código. Si lo renueva, el MFA reciente no protege nada, y la regla de mover (decisión 10) se decide de nuevo.

## Criterios de aceptación

### Backend: crear una cuenta

### CA-1: Crear un Personalizado con todas sus condiciones

- **Dado** `POST /v1/admin/clientes` con `{ nombre, tipo: 'empresa', plan: 'personalizado', condiciones: { contenido, asientos, equipo, horarios, hasta, cupos }, admin, motivo, clave }`,
- **cuando** se aplica,
- **entonces**:
  - la cuenta se crea con `crearTenant` y su credencial con `emitirCredencial`, como el alta en lote;
  - el Personalizado se aplica con `planearPersonalizado` y `aplicarPersonalizado`, el mismo camino que `npm run tenant -- personalizar`, con el motivo;
  - el admin se invita con `gobierno.invitar` (`admin: true`), que le manda el correo (decisión F);
  - en lo que ve el cliente (su bitácora de gobierno, la de su cuenta y el correo) firma `equipo-enso`, «el equipo de ENSŌ», nunca el id interno de quien lo hizo; quién fue exactamente queda en la auditoría del equipo (CA-7);
  - responde 201 con la cuenta en la forma de la lista (`resumenDeCliente`) y `correoDeInvitacion`, que dice si el correo salió;
  - la respuesta nunca trae la license key (decisión 1).

### CA-2: Crear una cuenta Free

- **Dado** `plan: 'free'`, sin `condiciones`,
- **cuando** se aplica,
- **entonces** la cuenta queda en Free (un asiento), con su admin invitado como en CA-1.

### CA-3: Una cuenta personal es de una persona

- **Dado** `tipo: 'personal'`,
- **cuando** se aplica,
- **entonces** la cuenta nace personal, con un asiento y sin equipo. Si `condiciones` pide más de un asiento o equipo, responde 422 y no escribe nada.

### CA-4: Todo se valida antes de escribir

- **Dado** un pedido con nombre vacío o de más de 120 caracteres, un correo sin forma de correo, condiciones que `planearPersonalizado` rechaza, un campo que el pedido no admite (como `paquete`, decisión 5), sin motivo o con un cuerpo de más de 16 KB,
- **cuando** se pide,
- **entonces** responde 422, o 413 por el tamaño, con lo que hay que corregir (los rechazos de `planearPersonalizado`, tal cual), y no escribe nada.

### CA-5: El correo del admin se revisa antes de crear la cuenta

- **Dado** un `admin` cuyo correo ya está en el índice,
- **cuando** se pide,
- **entonces** no se crea nada, y:
  - si es de otra empresa: 409 `correo-de-otra-empresa`, con `{ empresa: { id, nombre } }`. El equipo puede ver de cuál; un cliente desde «Mi equipo», no (A-06);
  - si es de una cuenta personal: 409 `correo-en-cuenta-personal`, con `{ cuenta: { id, nombre, pagaPorStripe } }`, salvo que el pedido traiga `moverDesdeCuentaPersonal: true` (CA-10).

### CA-6: Crear dos veces es crear una

- **Dado** el mismo pedido con la misma `clave` (la genera el panel al dibujar el formulario) dentro de las 24 h,
- **cuando** llega otra vez (un doble clic, un reintento después de un corte),
- **entonces** no crea otra cuenta: responde 200 con la misma, y termina lo que el primero dejó a medias (CB-2). La misma `clave` con otro cuerpo responde 409.

### CA-7: Crear queda en la auditoría

- **Dado** una cuenta creada,
- **cuando** se mira Gobernanza,
- **entonces** hay un evento `empresas.crear` con el actor `equipo:<sub>`, el motivo y lo creado (`id`, `nombre`, `tipo`, `plan`, `condiciones`). La invitación queda en la bitácora de gobierno de la cuenta, igual que desde «Mi equipo».

### Backend: invitar a una persona

### CA-8: Invitar a una cuenta que existe

- **Dado** `POST /v1/admin/clientes/{id}/personas` con `{ correo, admin, rol, motivo }`,
- **cuando** se aplica,
- **entonces** invita con `gobierno.invitar` (actor `equipo:<sub>`), con sus mismas reglas y respuestas:
  - sin cupo: 409 con `usados` y `tope`;
  - un rol que no existe: 422 con los roles que hay;
  - ya tiene asiento: 409;
  - un asiento revocado: 409, sin reactivarlo en silencio.

  Manda el correo (decisión F), responde 201 con el asiento y `correoDeInvitacion`, y anota `usuarios.invitar` con el motivo.

### CA-9: Un correo de otra empresa o de una cuenta personal

- **Dado** un `correo` que ya está en el índice,
- **cuando** se invita,
- **entonces** responde como CA-5: 409 `correo-de-otra-empresa` con la empresa, o 409 `correo-en-cuenta-personal` con la cuenta, salvo `moverDesdeCuentaPersonal: true`.

### Backend: mover desde una cuenta personal (decisión 3)

### CA-10: Mover borra la cuenta personal y continúa

- **Dado** un pedido de CA-1, CA-2 u CA-8 con `moverDesdeCuentaPersonal: true`, cuyo correo es de una cuenta personal que no paga por Stripe,
- **cuando** se aplica,
- **entonces** borra esa cuenta con `borrarCliente`, el borrado del producto, que deja «borrado-pedido» en su bitácora con el actor, y sigue con la creación o la invitación como si el correo estuviera libre. Responde lo mismo que sin mover, más `movidaDesde: <id de la cuenta personal>`.

### CA-11: Mover es del superadministrador, con MFA reciente

- **Dado** un pedido con `moverDesdeCuentaPersonal: true`,
- **cuando** lo pide alguien que no es superadministrador, o cuyo MFA tiene más de 15 min,
- **entonces** responde 403, o 401 `mfa-reciente`, y no toca nada (decisión 10).

### CA-12: Una cuenta personal que paga por Stripe no se mueve

- **Dado** un correo de una cuenta personal con cliente de Stripe (`stripeCustomerId`),
- **cuando** se pide moverla,
- **entonces** responde 409 `cuenta-personal-con-cobro` y no toca nada. Borrarla dejaría un cobro sin cuenta: primero se cancela en Stripe.

### CA-13: Mover queda en la auditoría

- **Dado** una persona movida,
- **cuando** se mira Gobernanza,
- **entonces** hay un evento `usuarios.mover-desde-cuenta-personal` con el actor, el motivo, `desde` (la cuenta borrada) y `hacia` (la cuenta destino).

### Backend: permisos y contenido

### CA-14: Quién puede qué

- **Dado** una persona del equipo,
- **cuando** pide crear, invitar o mover,
- **entonces**:
  - crear pide `empresas: editar`;
  - invitar pide `usuarios: editar`;
  - mover pide además ser superadministrador con MFA reciente (CA-11);
  - con «ver» o sin el módulo responde 403, y una cuenta que el filtro de clientes esconde responde 404, como si no existiera.

### CA-15: Una cuenta nueva recibe el contenido estándar

- **Dado** una cuenta creada desde el panel,
- **cuando** se mira su paquete,
- **entonces** es el estándar de su plan: el de Pro para un Personalizado, como en `npm run tenant -- personalizar` sin `--paquete`, y el de Free para Free. Ningún pedido puede elegir un paquete a medida (decisión 5).

### Panel: crear

### CA-16: Los botones para crear

- **Dado** Empresas, con `empresas: editar`,
- **cuando** se ve,
- **entonces** la pestaña Empresas tiene «Nueva empresa» y la de Cuentas personales, «Nueva cuenta personal». Sin el permiso, los botones no están, y la ruta del formulario responde «sin acceso».

### CA-17: El formulario

- **Dado** «Nueva empresa»,
- **cuando** se abre,
- **entonces** pide:
  - nombre;
  - plan: Personalizado o Free;
  - en Personalizado: contenido (todo, Free o nada), asientos, equipo, horarios, fecha de fin o ninguna y los cupos de radar, proyectos, skills y cadenas (un número o «sin tope»);
  - correo del admin;
  - motivo.

  Viene lleno con el caso más común: Personalizado, contenido todo, 2 asientos, equipo sí, horarios sí, sin fecha y cupos sin tope. «Nueva cuenta personal» viene con 1 asiento y sin equipo, y esos dos campos no se pueden cambiar.

### CA-18: Al guardar

- **Dado** un formulario válido,
- **cuando** se guarda,
- **entonces** lleva a la ficha de la cuenta nueva con un aviso: «Cuenta creada. Le enviamos la invitación a su admin.». Si el correo no salió: «Cuenta creada, pero el correo de invitación no salió: el admin puede entrar igual con su correo.». El aviso viaja en la dirección (`?aviso=`), así que no nombra el correo (CB-5).

### CA-19: Los errores, junto a su campo

- **Dado** una respuesta 409 o 422 del backend,
- **cuando** vuelve al formulario,
- **entonces** el formulario conserva lo escrito y muestra el error junto a su campo: el correo de otra empresa, diciendo cuál; las condiciones rechazadas, una por una; el motivo vacío.

### CA-20: La confirmación de mover

- **Dado** un correo de una cuenta personal (409 `correo-en-cuenta-personal`),
- **cuando** vuelve al formulario,
- **entonces**:
  - si no paga por Stripe: «<correo> tiene una cuenta personal (<id>). Si sigues, esa cuenta se borra y la persona pasa a <empresa>», con «Borrar la cuenta personal y seguir». El botón solo aparece para un superadministrador;
  - si paga por Stripe: solo el aviso de que primero hay que cancelar la suscripción.

### CA-21: El botón se bloquea mientras se procesa, y un doble clic no crea dos cuentas

- **Dado** el formulario de crear, el de invitar o la confirmación de mover,
- **cuando** se oprime el botón,
- **entonces**:
  - el botón queda desactivado hasta que llega la respuesta, cambia su texto («Creando…», «Invitando…», «Moviendo…») y muestra un indicador de carga, con `aria-busy`. No se puede oprimir de nuevo ni mandar el formulario con Enter;
  - con la respuesta, vuelve a estar disponible si hubo un error, y si salió bien la pantalla cambia;
  - es un solo botón compartido (`app/shared/ui/`), el mismo en los tres formularios;
  - el botón principal va **antes** que el de mover en el formulario: con Enter, el navegador usa el primer botón, y si fuera el de mover, Enter en cualquier campo borraría una cuenta personal.

  Además, el formulario lleva una `clave` nueva al dibujarse, que viaja en cada reintento (CA-6). Así, si la página todavía no cargó su JavaScript y el botón no puede bloquearse, el backend igual crea una sola cuenta.

### Panel: invitar

### CA-22: Invitar desde las personas de una cuenta

- **Dado** la página de personas de una cuenta (`/client-users/:id`), con `usuarios: editar`,
- **cuando** se usa «Invitar persona»,
- **entonces** pide correo, admin sí o no, rol (los de esa cuenta) y motivo. Al terminar, la persona aparece en la lista como «Invitada», con el aviso del correo como en CA-18. Los errores y la confirmación de mover son los de CA-19 y CA-20.

### CA-23: La license key no aparece

- **Dado** cualquier pantalla del panel,
- **cuando** se crea una cuenta o se invita,
- **entonces** ni la license key ni la credencial de publicación llegan al panel (decisión 1).

## Casos borde

### CB-1: Un correo con mayúsculas o espacios

- **Dado** ` Ana@Acme.com `,
- **cuando** se crea o se invita,
- **entonces** se normaliza como en todo el backend (`correoNormalizado`), y las revisiones de CA-5 y CA-9 usan el correo normalizado.

### CB-2: Un corte a mitad

- **Dado** una creación que se corta después de crear la cuenta y antes de invitar al admin, o un mover que se corta después de borrar la cuenta personal,
- **cuando** se repite el mismo pedido, con la misma `clave`,
- **entonces** termina lo que faltó sin repetir lo hecho. Mientras tanto, la ficha de la cuenta dice «sin admin», y la respuesta del primer intento dice qué quedó hecho.

### CB-3: El correo de invitación falla

- **Dado** un fallo de SES,
- **cuando** se invita,
- **entonces** la cuenta y el asiento quedan, `correoDeInvitacion` lo dice, y la persona puede entrar igual con su correo (CA-18).

### CB-4: Dos personas del equipo con el mismo correo a la vez

- **Dado** dos pedidos simultáneos que invitan el mismo correo a cuentas distintas,
- **cuando** se aplican,
- **entonces** gana uno, y el otro responde `correo-de-otra-empresa` sin dejar una cuenta a medias. Es la misma carrera que ya resuelve `gobierno.invitar`.

### CB-5: Ningún correo en una URL ni en los logs

- **Dado** cualquier pedido de esta spec,
- **cuando** viaja y se registra,
- **entonces** los correos van en el cuerpo de un POST, nunca en la dirección, y ninguna línea de log los lleva.

### CB-6: El panel que ya está desplegado no cambia

- **Dado** el backend nuevo con el panel de antes,
- **cuando** se usa,
- **entonces** todo sigue igual: las rutas son nuevas y no cambia ninguna respuesta de lectura.

### CB-7: Lo que dejaron ver las revisiones (quality-gate y seguridad, 2026-11-04)

- **Un corte en el panel vuelve al formulario, no a la página de error.** Un 5xx o un corte del panel a los 25 s devuelven el rechazo `unavailable` con lo escrito y la misma clave, y el formulario dice que no se sabe si se hizo. La página de error pediría el formulario con otra clave, y reintentar ahí sí crearía otra cuenta.
- **La clave es también un candado.** Mientras un pedido la tiene (hasta 35 s), otro con la misma clave recibe 409 `alta-en-curso`. Dos pedidos a la vez crean una sola cuenta y un solo `empresas.crear`.
- **Mover se puede retomar.** El borrado del producto empieza por la ficha: si se corta, el correo ya se ve libre. Antes de borrar queda una marca en la cuenta destino (`movidas:<destino>`). Cada reintento que pide mover la termina primero y recién ahí anota `usuarios.mover-desde-cuenta-personal`, una sola vez.
- **Antes de borrar se mira la cuenta otra vez:** que siga siendo personal, sin cliente ni suscripción de Stripe y con una sola persona.
- **El motivo es del equipo.** La bitácora que ve el cliente dice «alta desde el panel de ENSŌ»; el motivo real queda solo en la auditoría del equipo.
- **Si la cuenta ya quedó creada** y el pedido terminó en un rechazo, la respuesta trae `cuentaCreada`, y el formulario la nombra con su enlace.
- **El correo y el nombre se validan en el backend.**
  - El correo: hasta 254 caracteres y sin `< > ( ) [ ] , ; : "`, porque SES podría leer otra dirección.
  - El nombre: sin `@`, que armaría el id con un correo, y sin caracteres invisibles.
  - Los asientos: hasta 1000.
  - Los cupos con nombre de objeto (`constructor`) se rechazan.

**Sigue abierto, para decidir aparte:**
- la opción B del MFA, que mover necesita para funcionar en producción;
- si invitar a alguien como admin a una cuenta que ya tiene admin pide superadministrador;
- un vencimiento (TTL) para las filas de clave;
- guardar el formulario al volver de ingresar el código.

## Infraestructura

- **Dos funciones nuevas:**
  - `AdminCrearCliente` y `AdminInvitarPersona`, que escriben, con lo justo:
    - leer y escribir en `tenants`, y en `eventos` solo agregar (`PutItem`);
    - leer el bucket de bundles, solo crear (si el paquete estándar del plan está publicado, como pide `planearPersonalizado`);
    - enviar por el canal de invitaciones de SES, como `TeamMiembros`;
    - para mover, lo que borra `borrarCliente`, solo listar y borrar: `Query` y `DeleteItem` en `teampublishes`, `ListBucket` y `DeleteObject` en `teambundles`. Nunca escribir ahí.
- **Las rutas nuevas** van en `infra/equipo.js`, con el mismo autorizador del equipo.
- **El diff del despliegue** debe mostrar solo esas funciones, sus rutas y sus permisos, sin `[-]`.

## Pruebas y despliegue

- **Antes del commit:** `quality-gate`, y además una revisión de seguridad de las rutas nuevas, porque es la primera escritura sobre clientes reales desde el panel. El plan pide una revisión defensiva antes de escribir sobre clientes reales (§7).
- **Orden:** primero el backend, después el panel.
- **Primera prueba en producción:** crear una cuenta de prueba, invitar a un correo propio, mover una cuenta personal de prueba, y borrar las dos con `eliminar-usuarios`.
