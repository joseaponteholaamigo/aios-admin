# Spec: Borrar cuentas y destrabar personas desde el panel

- **Fecha:** 2026-11-04
- **Origen:** dos pedidos de Jose del 2026-11-04, el mismo día.
  - Sobre cuentas: «¿Deberíamos tener la opción de borrar los clientes desde el superadmin?», y después «Sí».
  - Sobre personas: «También deberíamos contemplar cómo borrar un usuario específico solo de Cognito o completo, ya que hay usuarios que pueden perder el vínculo de la autenticación de dos factores y no pueden ingresar». Pidió que fuera en esta misma spec.
  - El plan del superadmin (`docs/2026-10-20-plan-superadmin-aws.md`, §3.2) ya reserva al superadministrador, con MFA reciente, «borrar personas o empresas».
- **Estado:** decisiones cerradas (2026-11-05); falta lo de «Antes de empezar»
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en la rama `superadmin_v2`.

## Objetivo

El equipo de ENSŌ resuelve desde el panel dos cosas que hoy pasan por la terminal, y cada acción deja registro de quién la hizo y cuándo:

- **Destrabar a una persona.** Si perdió la app de códigos de la verificación en dos pasos, hoy no puede entrar y nadie del equipo puede ayudarla sin la consola de AWS.
- **Borrar una cuenta entera.** Hoy solo la borra su admin desde ENSŌ (`DELETE /v1/team/cuenta`), o alguien que corre `npm run reset:pruebas` contra producción. El script es para cuentas de prueba: firma como `reset-pruebas` y no deja dicho quién autorizó el borrado.

## Decisiones

### Acciones sobre una persona

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Hay tres acciones sobre una persona, de la más suave a la más fuerte.** Para quien perdió la app de códigos se usa la primera. | Jose, 2026-11-04 |
| | **Restablecer la verificación en dos pasos.** El login sigue y solo se desvincula la app (`AdminDeleteSoftwareToken`). En el siguiente ingreso, Cognito pide escanear un QR nuevo. | |
| | **Borrar solo el login.** Sirve cuando restablecer no alcanza. La persona se vuelve a registrar con el mismo correo y conserva su asiento, su rol y su acceso, porque el asiento se ata al correo y no al usuario de Cognito. El registro la acepta porque tiene asiento (`src/lib/pre-registro.js`). | |
| | **Borrar a la persona por completo.** Se borran su login, su asiento, su fila del índice de correos y sus ajustes de acceso. Es para quien ya no va en esa cuenta. | |
| 2 | **Las tres son solo del superadministrador, con MFA reciente y sin motivo.** Antes de hacerla, un diálogo le explica qué le va a pasar a la persona y le pide confirmar (CA-10). Cada una queda anotada: quién, qué, a qué cuenta y cuándo (CA-6). Es solo del superadministrador porque restablecer el segundo factor es justo lo que pide quien robó una contraseña («perdí el celular, restablézcanme»). | Jose, 2026-11-05 |
| 3 | **Restablecer y borrar el login le mandan un correo a la persona.** El texto dice qué pasó, qué tiene que hacer y que escriba si no lo pidió. Borrar a la persona no manda correo. | Jose, 2026-11-05 |
| 4 | **Las tres cierran todas las sesiones abiertas de la persona** (`AdminUserGlobalSignOut`), por si el celular perdido tenía una abierta. Sin esto, una sesión sigue viva hasta 30 días (`refreshTokenValidity`); con esto, el ENSŌ de ese equipo deja de funcionar cuando vence su pase de una hora (`accessTokenValidity`). | Jose, 2026-11-05 |
| 5 | **El código del segundo factor llega solo por la app de códigos, nunca por correo.** Cognito no permite el código por correo en un pool que recupera la contraseña solo por correo, y con razón: quien entrara al correo de una persona tendría los dos factores. A quien pierde el celular se lo destraba con «Restablecer» (decisión 1). | Jose, 2026-11-05 |
| 6 | **Borrar a la persona borra su asiento; no lo deja revocado.** El registro de quién estuvo queda en la bitácora de gobierno de la cuenta (`invito`, `borro-persona`), que no se va con la persona. El correo queda libre, y volver a invitarla a la misma cuenta funciona como con alguien nuevo. Revocar desde «Mi equipo» sigue igual: deja el asiento `revocado`. | Jose, 2026-11-05 |
| 7 | **El correo de una persona nunca va en una URL**, ni del panel ni de la API: siempre en el cuerpo del pedido. Las direcciones quedan en los registros de CloudFront y de API Gateway. | Regla de seguridad del workspace |

### Borrar una cuenta

| # | Decisión | Quién y cuándo |
|---|---|---|
| 8 | **Solo el superadministrador, con MFA reciente** (opción B: `auth_time` de menos de 15 min). Tener «editar» en Empresas no alcanza. | Plan §3.2; Jose, 2026-11-04 |
| 9 | **Motivo opcional.** El formulario tiene el campo «Motivo», pero se puede borrar sin llenarlo. Si se llena, queda en la auditoría del equipo, que es lo único que sobrevive al borrado: la bitácora del cliente se borra con él. | Jose, 2026-11-05 |
| 10 | **Se confirma escribiendo el id de la cuenta**, igual que el borrado que pide el propio cliente (el campo `confirmo` de `/v1/team/cuenta`). | Jose, 2026-11-04 |
| 11 | **No se borra una cuenta cuya suscripción de Stripe sigue cobrando.** Primero se cancela en Stripe; si no, Stripe le sigue cobrando a una cuenta que ya no existe. Una suscripción cancelada no frena, ni la de un Personalizado que la descartó (CB-12). La regla de base es la de `compra.js` (`tieneSuscripcionActiva`), no la de mover. | Jose, 2026-11-04 |
| 12 | **Borrar una cuenta borra también a sus personas: sus asientos y sus logins.** La única excepción es el login de quien tiene su correo en otra cuenta, que se conserva para no dejarla afuera de esa otra. | Jose, 2026-11-05 |
| 13 | **El borrado es `borrarCliente`** (`src/lib/borrado.js`), el mismo que usan el borrado del cliente y mover. Esta spec no escribe lógica de borrado nueva. Lo que agrega: la vista previa, la marca para retomar un borrado cortado, los logins y la auditoría. | Jose, 2026-11-04 |
| 14 | **No se manda correo** a las personas de una cuenta borrada. El borrado se acuerda con el admin de la cuenta, y es él quien le avisa a su equipo. | Jose, 2026-11-05 |

## Antes de empezar

- **Aplicar y probar la opción B del MFA.** Hoy `exigirMfaReciente` (`src/lib/admin/puerta-del-equipo.js`) pide `acr = urn:cognito:loa:4`, y en producción mover responde siempre 401. Todo lo de esta spec respondería igual. Falta la prueba de Jose: que un login silencioso no renueve `auth_time`.
- **Comprobar el restablecimiento con una cuenta de prueba**, antes de construir CA-1. Se llama `AdminDeleteSoftwareToken` sobre esa cuenta y se entra a ENSŌ: el login gestionado tiene que pedir el QR nuevo (el reto `MFA_SETUP`).
  - Es una acción sobre la cuenta `enso`: se avisa antes y la corre Jose.
  - El SDK del backend (`@aws-sdk/client-cognito-identity-provider` 3.1138.0) ya trae `AdminDeleteSoftwareTokenCommand`. La operación es de agosto de 2026, y el CLI de AWS puede no tenerla todavía.
  - Si el login gestionado no pide el QR, restablecer pasa a ser «borrar el login», y esta spec se corrige antes de seguir.

## Orden de construcción

1. El adaptador del pool de Cognito de clientes (`src/lib/admin/identidades-de-clientes.js`). Lo usan las dos partes.
2. Las acciones sobre una persona: hoy no hay forma de destrabar a alguien sin la consola.
3. El borrado de cuentas: mientras tanto, para pruebas existe el script.

## Alcance

- **Backend:**
  - `POST /v1/admin/clientes/{id}/personas/restablecer-mfa`, con `{ correo }`;
  - `POST /v1/admin/clientes/{id}/personas/borrar-login`, con `{ correo }`;
  - `POST /v1/admin/clientes/{id}/personas/borrar`, con `{ correo }`;
  - `GET /v1/admin/clientes/{id}/borrado`: la vista previa de lo que se borra;
  - `POST /v1/admin/clientes/{id}/borrado`, con `{ confirmo }` y `motivo` opcional;
  - `GET /v1/admin/borrados-pendientes`: los borrados que empezaron y no terminaron.
- **Panel:**
  - en las personas de una cuenta (`client-users/:companyId`), las tres acciones de cada persona, cada una con su diálogo de confirmación, solo para el superadministrador;
  - en la página de la cuenta (`companies/:companyId`), el botón «Borrar cuenta», solo para el superadministrador, y la confirmación en `companies/:companyId/delete`;
  - en Empresas, el aviso de éxito y el de los borrados sin terminar.

## Fuera de alcance

- **Los proyectos compartidos donde estaba una persona borrada.** Quedan como quedan hoy cuando «Mi equipo» revoca a alguien.
- **Logins sin asiento** de borrados anteriores. Siguen con `npm run reset:pruebas`.
- **El código del segundo factor por correo.** Cognito no lo permite mientras la contraseña se recupere solo por correo (decisión 5).
- **Restablecer la contraseña.** La persona ya lo hace sola desde «¿Olvidaste tu contraseña?», por correo.
- **Cambiar el rol o la condición de admin** de una persona.
- **Suspender, reactivar o revocar una cuenta** (`/suspender`, `/reactivar`, `/revocar` del plan, AD-12).
- **Borrar varias cuentas a la vez**, una papelera o deshacer.
- **Cancelar la suscripción de Stripe desde el panel.**
- **Cambiar el borrado del propio cliente** (`/v1/team/cuenta`) para que también borre los logins.
- **Limpiar el estado que queda en el ENSŌ de cada persona** (`sesion.json`, la licencia en `config.json`).
- `npm run reset:pruebas` sigue igual, para las cuentas de prueba.

## Criterios de aceptación

### Acciones sobre una persona: backend

### CA-1: Restablecer la verificación en dos pasos
- **Dado** un superadministrador con MFA reciente y una persona con asiento vigente en una cuenta visible, con login y app de códigos vinculada
- **Cuando** pide `POST …/personas/restablecer-mfa` con su correo
- **Entonces** recibe 200
- **Y** el usuario sigue en el pool de clientes, pero sin app de códigos (se llamó `AdminDeleteSoftwareToken`), y sus sesiones quedaron cerradas (`AdminUserGlobalSignOut`)
- **Y** el asiento no cambia: mismo estado, rol y admin.

### CA-2: Después de restablecer, entrar pide el QR nuevo
- **Dado** una persona de prueba a la que se le restableció la verificación (CA-1)
- **Cuando** entra a ENSŌ con su correo y su contraseña
- **Entonces** el login le pide escanear un QR nuevo, y después de escanearlo entra a su cuenta con todo lo que tenía.

### CA-3: Borrar solo el login
- **Dado** un superadministrador con MFA reciente y una persona con asiento vigente y login
- **Cuando** pide `POST …/personas/borrar-login` con su correo
- **Entonces** recibe 200, el pool de clientes ya no tiene usuario con ese correo y el asiento no cambia
- **Y** el pre-registro acepta ese correo (`src/lib/pre-registro.js`): la persona puede registrarse de nuevo y vuelve a su misma cuenta.

### CA-4: Borrar a la persona por completo
- **Dado** un superadministrador con MFA reciente y una persona con asiento vigente y login, que no es la única admin
- **Cuando** pide `POST …/personas/borrar` con su correo
- **Entonces** recibe 200, sus sesiones quedaron cerradas y su login ya no existe
- **Y** ya no existen su asiento, su fila del índice de correos (el correo queda libre) ni su fila `persona#<correo>` del acceso de la cuenta
- **Y** si después se la invita a la misma cuenta, se crea un asiento nuevo, sin `asiento-revocado`.

### CA-5: Restablecer y borrar el login avisan a la persona; borrarla no
- **Dado** una acción que terminó bien
- **Entonces**, si fue restablecer o borrar el login, sale un correo a la persona por la puerta de correo (`asegurarPuertaDeCorreo`) que dice qué pasó, qué tiene que hacer y que escriba si no lo pidió, y la respuesta dice `correoDeAviso: 'enviado'`
- **Y** si el correo falla, la acción se mantiene y la respuesta dice `correoDeAviso: 'no-enviado'`
- **Y** borrar a la persona no manda correo.

### CA-6: Cada acción queda en las dos bitácoras, y el correo solo en la del cliente
- **Dado** una acción que terminó bien
- **Entonces** la tabla `eventos` tiene un renglón `usuarios.restablecer-mfa`, `usuarios.borrar-login` o `usuarios.borrar`, con objetivo `tenant#<id>`, actor `equipo:<sub>` y la hora, **sin el correo**
  - `eventos` no se puede borrar después, así que no guarda datos de personas.
- **Y** la bitácora de gobierno de la cuenta tiene `restablecio-mfa`, `borro-login` o `borro-persona`, sobre ese correo, con actor `equipo-enso`
- **Y** las tres son acciones nuevas de `ACCIONES` (`src/lib/bitacora-de-gobierno.js`).

### CA-7: Solo el superadministrador, con MFA reciente
- **Dado** cualquiera de las tres acciones
- **Cuando** la pide alguien del equipo que no es superadministrador, entonces recibe 403
- **Cuando** la pide un superadministrador con el MFA vencido, entonces recibe 401 con `codigo: 'mfa-reciente'`
- **Y** en los dos casos no cambia nada: ni el asiento, ni el login, ni las sesiones.

### CA-8: El correo nunca va en la URL
- **Dado** las rutas nuevas de `RUTAS_ADMIN` (`src/lambda.js`) y de `route-table.ts`
- **Entonces** ninguna lleva el correo en la ruta ni en la consulta
- **Y** el pedido que arma el panel para cada acción no tiene `@` en su URL.

### Acciones sobre una persona: panel

### CA-9: Las acciones solo las ve el superadministrador
- **Dado** las personas de una cuenta (`client-users/:companyId`)
- **Cuando** las ve un superadministrador, entonces cada persona tiene «Restablecer verificación en dos pasos», «Borrar login» y «Borrar persona»
- **Y** cuando las ve alguien que no lo es, no aparece ninguna.

### CA-10: Cada acción se confirma en su diálogo
- **Dado** un superadministrador que elige una acción
- **Entonces** se abre su diálogo, con el correo de la persona, la explicación de lo que le va a pasar, «Cancelar» y el botón de la acción. Nada cambia hasta que se pulsa el botón. Las explicaciones:
  - Restablecer: «`<correo>` va a tener que escanear un QR nuevo con su app de códigos la próxima vez que entre. Su contraseña, su empresa y su acceso no cambian. Se cierran las sesiones que tenga abiertas y le llega un correo avisando.»
  - Borrar login: «`<correo>` no va a poder entrar hasta que se registre otra vez con el mismo correo, con contraseña y QR nuevos. Conserva su empresa, su rol y su acceso. Se cierran las sesiones que tenga abiertas y le llega un correo avisando.»
  - Borrar persona: «`<correo>` sale de `<cuenta>`: se borran su login, su asiento y sus ajustes de acceso. No se puede deshacer: para que vuelva hay que invitarla de nuevo. No le llega ningún correo.»
  - Si cambian las decisiones 3 o 4 (el correo de aviso y el cierre de sesiones), cambian estas explicaciones.
- **Y** el botón usa el `SubmitButton` compartido: mientras el pedido está en curso dice «Restableciendo…» o «Borrando…», lleva `aria-busy="true"` y no se puede pulsar otra vez.

### CA-11: Al terminar, la pantalla dice qué pasó
- **Dado** una acción que terminó bien
- **Entonces** la página de personas muestra el aviso. Por ejemplo: «Se restableció la verificación en dos pasos de `<correo>`. Le llegó un correo con los pasos.»
- **Y** si `correoDeAviso` es `no-enviado`, el aviso dice que el correo no salió y que hay que avisarle a la persona por otro medio.

### CA-12: Los rechazos se dicen junto a la acción
- **Dado** un rechazo del backend
- **Entonces** el diálogo lo dice en palabras simples:
  - `mfa-reciente`: con el enlace para volver a ingresar el código (`FormRejection`);
  - `ultimo-admin`: «es la única admin: nombra a otra admin antes de borrarla»;
  - `sin-login`: «esta persona todavía no se registró: no tiene login».

### Borrar una cuenta: backend

### CA-13: La vista previa dice qué se borra sin borrar nada
- **Dado** un superadministrador con MFA reciente y una cuenta visible con personas, paquetes y bitácora
- **Cuando** pide `GET /v1/admin/clientes/{id}/borrado`
- **Entonces** recibe 200 con:
  - el id, el nombre, el tipo (empresa o personal) y el plan de la cuenta;
  - las personas, con su correo, si es admin y su estado (activa, invitada o revocada);
  - cuántas filas hay en cada sitio de `sitiosDeUnCliente` y cuántos paquetes;
  - `cobra` (decisión 11) y `pendiente: false`
- **Y** después del pedido cada sitio sigue con las mismas filas.

### CA-14: Borrar se lleva todo lo de la cuenta
- **Dado** un superadministrador con MFA reciente y una cuenta visible que no cobra por Stripe
- **Cuando** pide `POST /v1/admin/clientes/{id}/borrado` con `confirmo` igual al id
- **Entonces** recibe 200 con `completo: true` y la cuenta de filas borradas en cada sitio
- **Y** ningún sitio de `sitiosDeUnCliente(id)` conserva filas de esa cuenta, y `teambundles` no tiene nada bajo `<id>/`.

### CA-15: Se borra el login de quien se queda sin cuenta
- **Dado** una cuenta con dos personas, y una de ellas tiene además su correo en otra cuenta (un dato inconsistente heredado)
- **Cuando** se borra la cuenta (CA-14)
- **Entonces** el pool de clientes ya no tiene usuario con el correo de quien no estaba en otra cuenta
- **Y** el login de quien sí estaba en otra cuenta sigue intacto
- **Y** el pool del equipo ENSŌ no recibe ningún pedido.

### CA-16: La auditoría guarda quién, cuándo y por qué, sin datos de las personas
- **Dado** un borrado completo (CA-14)
- **Entonces** la tabla `eventos` tiene un solo renglón `clientes.borrar`, con objetivo `tenant#<id>`, actor `equipo:<sub>`, canal `api` y el motivo si se dio
- **Y** en `antes` van solo el tipo, el plan y cuántas personas había, y en `despues`, `completo` y la cuenta por sitio
- **Y** ese renglón no lleva ningún correo ni el nombre de la cuenta.

### CA-17: Ante el cliente firma «el equipo de ENSŌ»
- **Dado** un borrado desde el panel
- **Entonces** los renglones `borrado-pedido` y `borrado-hecho` de la bitácora del cliente llevan el actor `equipo-enso` (`EQUIPO_ANTE_EL_CLIENTE`), nunca el `sub` de la persona del equipo.

### CA-18: Solo el superadministrador, con MFA reciente
- **Dado** una persona del equipo con «editar» en Empresas que no es superadministradora
- **Cuando** pide la vista previa, el borrado o los pendientes
- **Entonces** recibe 403 y no se borra nada
- **Y** un superadministrador con el MFA vencido recibe 401 `mfa-reciente` al pedir el borrado.

### CA-19: Sin la confirmación exacta no se borra
- **Dado** un superadministrador con MFA reciente
- **Cuando** `confirmo` falta, está vacío o no es el id (también si solo cambian mayúsculas o espacios), entonces recibe 422 con `codigo: 'confirmacion'`
- **Cuando** el motivo pasa de 500 caracteres (`LARGO_DEL_MOTIVO`), entonces recibe 422 con `codigo: 'invalido'`
- **Y** en los dos casos no se borra nada
- **Y** un motivo que falta o está en blanco no es un error: se borra igual, y la auditoría queda sin motivo.

### CA-20: Una suscripción que cobra frena el borrado; una cancelada no
- **Dado** una cuenta cuya suscripción de Stripe sigue cobrando
- **Cuando** se pide el borrado
- **Entonces** recibe 409 con `codigo: 'cuenta-con-cobro'`, no se borra nada y la vista previa dice `cobra: true`
- **Y** si la suscripción está cancelada, el borrado sigue como en CA-14.

### CA-21: Un borrado cortado se termina al repetirlo
- **Dado** un borrado que se cortó después de borrar la ficha (la cuenta ya no está en la lista)
- **Cuando** se repite `POST …/borrado` con el mismo id y la confirmación
- **Entonces** se borra lo que faltaba, incluidos los logins, y responde 200 con `completo: true`
- **Y** la auditoría tiene un solo renglón `clientes.borrar` para esa cuenta
- **Y** antes de repetir, la vista previa de ese id responde 200 con `pendiente: true`, no 404.

### CA-22: Los borrados sin terminar se pueden encontrar
- **Dado** un borrado cortado (CA-21)
- **Cuando** un superadministrador pide `GET /v1/admin/borrados-pendientes`
- **Entonces** recibe ese id, la fecha en que empezó y quién lo pidió
- **Y** cuando el borrado termina, el id ya no aparece.

### Borrar una cuenta: panel

### CA-23: El botón solo lo ve el superadministrador
- **Dado** la página de una cuenta (`companies/:companyId`)
- **Cuando** la abre un superadministrador, entonces ve «Borrar cuenta»
- **Y** cuando la abre alguien que no lo es, no lo ve, y si entra a mano a `companies/:companyId/delete` termina en la página de sin permiso.

### CA-24: La confirmación muestra el plan antes de borrar
- **Dado** un superadministrador en `companies/:companyId/delete`
- **Entonces** ve el nombre, el tipo y el plan de la cuenta, la lista de personas, lo que se borra en cada sitio, el campo «Motivo (opcional)» y el campo «Escribe `<id>` para confirmar»
- **Y** el botón «Borrar cuenta» queda deshabilitado hasta que lo escrito sea igual al id
- **Y** el botón usa el `SubmitButton` compartido, con «Borrando…» mientras el pedido está en curso, y Enter manda un solo pedido.

### CA-25: Al terminar vuelve a Empresas con el aviso
- **Dado** un borrado completo
- **Entonces** el panel lleva a `/companies`, o a `/companies?kind=personal` si era una cuenta personal, con el aviso «Se borró la cuenta `<id>`»
- **Y** la cuenta ya no aparece en la lista.

### CA-26: Una cuenta que cobra no se puede borrar desde la pantalla
- **Dado** una cuenta con `cobra: true`
- **Cuando** se abre su confirmación
- **Entonces** la pantalla dice que primero hay que cancelar la suscripción en Stripe y no muestra el botón «Borrar cuenta».

### CA-27: Un borrado a medias se dice y se termina desde el panel
- **Dado** un borrado que respondió incompleto
- **Entonces** la pantalla dice que no terminó, nombra los sitios que fallaron y ofrece «Terminar el borrado», que repite el pedido
- **Y** mientras haya borrados pendientes (CA-22), Empresas muestra «Hay borrados sin terminar», con un enlace a la confirmación de cada uno
- **Y** un rechazo `mfa-reciente` muestra el enlace para volver a ingresar el código (`FormRejection`).

## Casos borde y de error

### Acciones sobre una persona

### CB-1: Una persona invitada que nunca se registró
- **Dado** una persona con asiento `invitado` y sin usuario en el pool
- **Cuando** se pide restablecer o borrar el login, entonces responde 409 con `codigo: 'sin-login'`
- **Y** cuando se pide borrarla, se salta el login, borra el asiento y responde 200.

### CB-2: Una persona sin app de códigos vinculada
- **Dado** una persona con login que nunca terminó de vincular su app
- **Cuando** se pide restablecer
- **Entonces** responde 200 igual (no hay nada que desvincular), cierra sus sesiones y lo anota.

### CB-3: Un correo que no tiene asiento en esa cuenta
- **Cuando** se pide cualquiera de las tres acciones
- **Entonces** responde 404 con `codigo: 'no-existe'`, sin decir si el correo está en otra cuenta.

### CB-4: La única admin
- **Dado** la persona es la única admin de la cuenta (`dejariaSinAdmin`)
- **Cuando** se pide borrarla
- **Entonces** responde 409 con `codigo: 'ultimo-admin'`, y no cambia ni el asiento ni el login
- **Y** en una cuenta personal esto siempre pasa: para sacar a esa persona se borra la cuenta.

### CB-5: Borrar a alguien que «Mi equipo» ya revocó
- **Dado** una persona con el asiento revocado y el login todavía vivo
- **Cuando** se pide borrarla
- **Entonces** borra el login y el asiento revocado, y responde 200: borrar termina en «sin asiento y sin login», haya empezado donde haya empezado.

### CB-6: Falla algo a mitad de borrar a la persona
- **Dado** el orden fijo: primero las sesiones y el login, después el asiento, el índice y el acceso
- **Cuando** falla Cognito, entonces responde 503 con `codigo: 'borrar-incompleto'` y el asiento sigue intacto
- **Cuando** el login ya se borró y falla borrar el asiento, entonces responde 503 con el mismo código
- **Y** en los dos casos el mensaje y el log no llevan el correo, y repetir el pedido lo termina (CB-1: sin login, borra el asiento)
  - Al revés no se podría repetir: sin asiento, el pedido responde `no-existe` (CB-3) y el login quedaría suelto.

### CB-7: Un login que usa otra cuenta
- **Dado** el índice de correos dice que ese correo es de otra cuenta (un asiento huérfano en esta, dato heredado)
- **Cuando** se pide borrar el login, entonces responde 409 `correo-de-otra-empresa` y no lo borra
- **Y** cuando se pide borrarla, borra el asiento de esta cuenta, no toca el índice de la otra y conserva el login.

### CB-8: Repetir la misma acción
- **Dado** una acción que ya terminó
- **Cuando** llega el mismo pedido otra vez (un reintento, un doble clic que se coló)
- **Entonces** no falla ni deshace nada, y la respuesta dice el estado en que quedó la persona
- **Y** borrar a una persona que ya se borró responde 404 `no-existe` (CB-3), sin cambiar nada.

### CB-9: Una cuenta escondida por el filtro de clientes
- **Dado** `AIOS_ADMIN_CLIENTES` limita las cuentas visibles y la de la persona no está entre ellas
- **Entonces** las tres acciones responden 404 `no-existe`.

### CB-10: Permisos mínimos de las acciones sobre una persona
- **Dado** la plantilla sintetizada
- **Entonces** la función de las tres acciones tiene sobre el ARN del pool de clientes solo `cognito-idp:ListUsers`, `AdminDeleteSoftwareToken`, `AdminUserGlobalSignOut` y `AdminDeleteUser`
- **Y** en `eventos` solo `PutItem`, y el permiso de SES de las invitaciones (`permitirInvitaciones`)
- **Y** ningún permiso de Cognito sobre el pool del equipo.

### Borrar una cuenta

### CB-11: Una cuenta escondida o que no existe
- **Dado** la cuenta está escondida por `AIOS_ADMIN_CLIENTES`, o no existe y no tiene un borrado pendiente
- **Cuando** se pide la vista previa o el borrado
- **Entonces** responde 404 con `codigo: 'no-existe'` y no se borra nada.

### CB-12: Un Personalizado que vino de Stripe y descartó su suscripción
- **Dado** una cuenta Personalizado con `stripeCustomerId`, `stripeSubscriptionId: null` y la suscripción vieja en `suscripcionesDescartadas`
- **Entonces** la vista previa dice `cobra: false` y el borrado sigue como en CA-14
- **Y** la regla del borrado tiene que excluir este caso: la segunda condición de `tieneSuscripcionActiva` (cliente de Stripe con un plan que no es Free) lo frenaría.

### CB-13: Una cuenta vieja con cliente de Stripe y sin id de suscripción
- **Dado** una cuenta que no es Personalizado, con `stripeCustomerId` y sin `stripeSubscriptionId`, en un plan de pago y con estado `active`, `past_due` o `trialing`
- **Entonces** el borrado se frena con `cuenta-con-cobro`: no se sabe si cobra, y ante la duda no se borra.

### CB-14: La suscripción empieza a cobrar entre la vista previa y la confirmación
- **Dado** una vista previa con `cobra: false`, y después un webhook de Stripe deja la suscripción vigente
- **Cuando** se confirma el borrado
- **Entonces** responde 409 `cuenta-con-cobro`, porque la regla se vuelve a revisar justo antes de borrar.

### CB-15: Dos borrados de la misma cuenta a la vez
- **Dado** un borrado en curso
- **Cuando** llega otro pedido de borrar la misma cuenta
- **Entonces** el segundo responde 409 con `codigo: 'borrado-en-curso'`, y la auditoría tiene un solo renglón `clientes.borrar`.

### CB-16: Falla un sitio o un login a mitad del borrado
- **Dado** `borrarCliente` devuelve `completo: false`, o Cognito falla al borrar un login
- **Entonces** responde 503 con `codigo: 'borrado-incompleto'` y los nombres de lo que falló (`identidades` para los logins), sin ningún correo en la respuesta ni en el log
- **Y** no se anota `clientes.borrar`, y el borrado queda pendiente (CA-22).

### CB-17: Una cuenta sin personas, o con revocadas e invitadas
- **Dado** una cuenta sin asientos, entonces se borra igual, la vista previa dice que no hay personas y no se llama a Cognito
- **Dado** asientos revocados o invitados que nunca entraron, entonces aparecen en la vista previa con su estado y sus logins siguen la decisión 12
- **Y** que alguien que nunca entró no tenga usuario en Cognito no es un fallo.

### CB-18: La marca de pendiente no guarda datos de personas
- **Dado** un borrado en curso o cortado
- **Entonces** su marca guarda solo el id de la cuenta, quién lo pidió, el motivo si se dio y la fecha, sin ningún correo ni el nombre de la cuenta
- **Y** la marca se borra cuando el borrado termina.

### CB-19: Permisos mínimos del borrado
- **Dado** la plantilla sintetizada
- **Entonces** la función que borra tiene: borrar en `tenants` y `teampublishes`; listar y borrar en `teambundles`; solo `PutItem` en `eventos`; y sobre el ARN del pool de clientes, solo `cognito-idp:ListUsers` y `AdminDeleteUser`
- **Y** ningún permiso de Cognito sobre el pool del equipo, ni `UpdateItem` o `DeleteItem` en `eventos`.

### Para las dos partes

### CB-20: La API no responde o responde 5xx
- **Dado** el panel manda una acción o un borrado y la API no responde a tiempo o responde un 5xx
- **Entonces** la pantalla se queda con lo escrito y avisa que no se sabe si se hizo (`unavailable` de M2b)
- **Y** repetir es seguro (CA-21 y CB-8).

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-3, CA-4, CA-5, CA-6, CB-1 a CB-9 | integración con motores en memoria y un doble del pool de clientes | `tests/admin-acciones-persona.test.js` (nuevo) |
| CA-7, CA-18 | integración | `tests/admin-permisos-por-ruta.test.js` (`EXIGE_PARA_ESCRIBIR` y las rutas nuevas) |
| CA-8 | inspección de `RUTAS_ADMIN` y de la tabla de rutas, y unit del pedido que arma el panel | `tests/admin-permisos-por-ruta.test.js` y los tests de `app/shared/api/` |
| CA-13 a CA-17, CA-19, CA-20, CB-11 a CB-14, CB-17 | integración con motores en memoria y un doble del pool | `tests/admin-borrar-cuenta.test.js` (nuevo) |
| CA-21, CA-22, CB-15, CB-16, CB-18 | integración con un motor que falla en un sitio (como el `Proxy` de mover en M2b) | `tests/admin-borrar-cuenta.test.js` |
| CB-10, CB-19 | síntesis de la plantilla | `tests/infra-equipo.test.js` |
| CA-9, CA-23 | unit (loader y tabla de rutas) | tests del panel, junto a los de `route-table` |
| CA-10, CA-11, CA-12, CA-24, CA-26, CA-27 | componente | tests del panel, junto a los de `new-account-form` e `invite-person-form` |
| CA-25, CB-20 | unit de la `action` | tests del panel, junto a los de `company-new` |
| CA-2 | manual con una cuenta de prueba | Jose, al cerrar «Antes de empezar» y de nuevo después del deploy |
| CA-3, CA-4, CA-14, CA-15 en producción | manual | Jose, con cuentas de prueba: después de borrar el login, la persona se registra y vuelve a su cuenta; después de borrar la cuenta, el correo queda libre y su login ya no entra |

Los tests nuevos del backend van en la lista de `npm test` de `package.json`: si no, no corren.

## Archivos probablemente afectados

**Backend (`aios-backend-superadmin`)**
- `src/lib/admin/identidades-de-clientes.js` (nuevo): el adaptador del pool de clientes, con el molde de `cognito-del-equipo.js`. Busca por correo, desvincula la app de códigos, cierra las sesiones y borra el login.
- `src/lib/admin/acciones-sobre-persona.js` (nuevo): las tres acciones.
- `src/lib/admin/borrar-cuenta.js` (nuevo): la vista previa, el borrado con su marca, retomar y los pendientes.
- `src/lib/borrado.js`: contar filas por sitio para la vista previa con el mismo `sitiosDeUnCliente`, sin un segundo inventario.
- `src/lib/compra.js`: sacar la regla de «sigue cobrando» a una sola función que use el borrado (decisión 11, CB-12).
- `src/lib/asientos.js`: `borrarAsiento`, que borra el asiento y su fila del índice en una sola escritura. El índice se borra solo si apunta a esta cuenta, como en `revocarAsiento`.
- `src/lib/bitacora-de-gobierno.js`: `restablecio-mfa`, `borro-login` y `borro-persona` en `ACCIONES`.
- El texto del correo de aviso, junto a `src/lib/correo-de-invitacion.js`.
- `src/handlers/`: un handler por ruta nueva, de 30 líneas o menos.
- `src/lib/admin/rutas-de-escritura.js`: los estados de `sin-login` (409), `ultimo-admin` (409), `borrar-incompleto` (503), `confirmacion` (422), `cuenta-con-cobro` (409), `borrado-en-curso` (409) y `borrado-incompleto` (503).
- `src/lambda.js` (`RUTAS_ADMIN`), `infra/equipo.js` (las funciones y sus permisos) e `infra/aios-stack.js` (el id y el ARN del pool de clientes para esas funciones).
- `package.json`: los tests nuevos en `npm test`.

**Panel (`aios-admin`)**
- `app/modules/client-users/components/people-table.tsx`: las acciones de cada persona.
- `app/modules/client-users/components/person-action-dialog.tsx` con su CSS (nuevos): el diálogo de confirmación.
- `app/modules/client-users/routes/company-people.tsx`: la `action` de las tres acciones y el aviso.
- `app/modules/client-users/components/governance-log-card.tsx`: los nombres de `restablecio-mfa`, `borro-login` y `borro-persona`.
- `app/shared/routing/route-table.ts`: `companies/:companyId/delete`, con acceso `superadmin`.
- `app/modules/companies/routes/company-delete.tsx` y `components/delete-account-form.tsx` con su CSS (nuevos).
- `app/modules/companies/routes/company.tsx`: el botón «Borrar cuenta».
- `app/modules/companies/routes/companies.tsx`: el aviso de éxito y el de los borrados sin terminar.
- `app/domain/person-actions.ts` y `app/domain/account-deletion.ts` (nuevos): lo que se pide, el resultado y los rechazos.
- `app/shared/api/`: las lecturas y escrituras nuevas y su traducción. Los nombres en español se traducen solo aquí.
- `app/shared/labels/write-rejection-labels.ts`: los mensajes de los códigos nuevos.

## Procedimiento del equipo (no es código)

- **Antes de restablecer la verificación o borrar un login, se confirma que quien lo pide es la persona.** Por ejemplo, que lo pida el admin de su empresa, o que escriba desde ese mismo correo. El panel no puede comprobarlo, y es la defensa contra «perdí el celular» dicho por quien robó la contraseña.

## Riesgos y preguntas abiertas

- **Lo de «Antes de empezar»:** sin la opción B del MFA, nada de esto funciona en producción. Si el login gestionado no pide el QR después de `AdminDeleteSoftwareToken`, la acción «restablecer» cambia.
- **El borrado que pide el propio cliente no borra los logins.** Con esta spec, los dos borrados quedan distintos. Igualarlos es otra spec.
- **El id de una cuenta personal lleva el nombre de la persona** (por ejemplo `mateo-folador-d35e8f`), y sobrevive en la auditoría y en `borrado-hecho`. Pasa igual con el borrado del cliente. Si se seudonimiza, se decide aparte.
- **Con el filtro de clientes en una lista**, la auditoría de una cuenta borrada deja de verse en Gobernanza, porque su id ya no está en la lista.
- **Una cuenta grande puede no terminar en los 30 s de la Lambda.** La marca permite terminarla al repetir (CA-21), pero conviene medir cuánto tarda la cuenta más grande de producción antes de darlo por cubierto.
- **El ENSŌ de una persona borrada o de una cuenta borrada queda con estado viejo** (`sesion.json`, la licencia en `config.json`). Hay que comprobar a mano qué muestra al reiniciar; si se rompe, el arreglo va aparte, en ENSŌ.
- **Hay dos reglas de «paga por Stripe»:** mover frena con cualquier cliente de Stripe (`pagaPorStripe`), y borrar solo con una suscripción que cobra. Unificarlas es otra decisión.
