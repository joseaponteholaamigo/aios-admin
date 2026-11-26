# Spec: Editar cuentas y personas desde el panel

- **Fecha:** 2026-11-26
- **Origen:** pedido de Jose del 2026-11-26: «Quiero que el superadmin tenga la capacidad de modificar lo más que se pueda de los usuarios de cuentas personales y las empresas». Pidió priorizar lo que se resuelve solo en el panel y apartar lo que toca el backend o ENSŌ.
- **Plan:** `docs/2026-11-26-plan-superadmin-editar-cuentas-y-personas.md` (raíz del workspace, fuera de git). Esta spec cubre sus fases 1 y 2.
- **Estado:** decisiones cerradas por Jose el 2026-11-26 («Vamos con el plan»): se toman las seis recomendaciones del plan. Lista para construir.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en la rama `superadmin_v2`.
- **Despliegues:** al final y los corre Jose. Ningún despliegue puede cambiarle algo a una cuenta que ya existe. Si aparece algo que sí lo haga, se revisa con Jose antes.

## Objetivo

El equipo de ENSŌ cambia desde el panel lo que hoy pide `npm run tenant` o pedirle al admin del cliente:

- **De una persona:** su rol y si es admin, revocarle el acceso y reenviarle la invitación.
- **De una cuenta (empresa o personal):** su plan y sus características (contenido, asientos, equipo compartido, horarios, fecha de fin y cupos).

Y ve en la ficha lo que tiene que mirar antes de cambiar algo.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Entran la fase 1 (solo panel) y la fase 2 (backend y panel)** del plan. | Jose, 2026-11-26 |
| 2 | **Permisos:** cambiar el rol y el admin, y reenviar la invitación, piden `usuarios: editar` (el mismo que invitar). Revocar es solo del superadministrador (casi no tiene vuelta, como borrar). Cambiar el plan pide `empresas: editar` (el mismo que hoy cambia los asientos). | Jose, 2026-11-26 |
| 3 | **Planes que ofrece «Cambiar plan»:** en una empresa, Free y Personalizado; en una cuenta personal, Free, Pro y Personalizado. Es lo mismo que al crear. El «Pro» del panel es un Personalizado de una persona con todo el contenido y horarios (`PRO_CONDITIONS`), no el Pro que se compra en la web. El Pro y el Team estándar (`set-tier`), el paquete a medida, el precio propio y la suscripción siguen en el comando. | Jose, 2026-11-26 |
| 4 | **Una cuenta con una suscripción de Stripe que cobra, o que puede volver a cobrar, no cambia de plan** desde el panel: primero se cancela en Stripe. Es la regla del borrado (`impideBorrar`, `src/lib/compra.js`). Excepción: un Personalizado que ya lo es puede cambiar sus condiciones, como hoy cambia sus asientos (su precio propio lo acordó el equipo y sigue igual). | Jose, 2026-11-26 |
| 5 | **El tope de la voz se muestra en la ficha** con un enlace a «Voz» que abre con la cuenta puesta. No hay formulario en la ficha. | Jose, 2026-11-26 |
| 6 | **No hay rutas, funciones ni permisos de AWS nuevos.** Las acciones sobre una persona van en `POST /v1/admin/clientes/{id}/personas/{accion}`, y el plan en `PATCH /v1/admin/clientes/{id}/condiciones`. | Plan §4.3 |
| 7 | **El panel que hoy está desplegado sigue funcionando con el backend nuevo.** El backend sale antes que el panel, y mientras tanto el panel viejo manda `{ asientos, motivo }` a `…/condiciones`: esa forma se sigue aceptando y responde lo mismo que hoy. | Regla de esta spec: ningún despliegue rompe lo que hay |
| 8 | **Bajar los asientos por debajo de los que están en uso se sigue rechazando** (`asientos-en-uso`, CB-9 de créditos por persona), también desde «Cambiar plan». | Spec de créditos por persona |
| 9 | **El correo de una persona no va en la auditoría del equipo ni en la URL.** Va en el cuerpo del pedido y en la bitácora de gobierno de su cuenta, como las acciones que ya existen. | Spec «Borrar cuentas y destrabar personas», CA-6 y CA-8 |
| 10 | **Ante el cliente firma «el equipo de ENSŌ»** (`EQUIPO_ANTE_EL_CLIENTE`). El motivo real queda en la auditoría del equipo. | Igual que el resto del panel |

## Superficie de seguridad

| Superficie | ¿La abre? | Por qué |
|---|---|---|
| Endpoint nuevo | No | Se amplían dos rutas que ya existen, detrás de la puerta del equipo |
| Permiso nuevo de una función | No | `adminAccionSobrePersona` ya escribe en `tenants`, agrega a la auditoría, manda el correo de invitación y apaga la llave de la voz. `adminCondiciones` ya escribe en `tenants`, lee el bucket de paquetes y agrega a la auditoría. Lo confirma `tests/infra-stack.test.js` sin cambios |
| Dato de cliente nuevo | No | — |
| Recurso nuevo de AWS | No | — |

## Contrato de la API

### Ficha de la cuenta

`GET /v1/admin/clientes/{id}` suma un campo: `stripePuedeCobrar` (sí o no). Sí cuando la cuenta tiene una suscripción que cobra o puede volver a cobrar (`impideBorrar`). Es lo que desactiva «Cambiar plan» (CA-27). `pagaPorStripe`, que ya viaja, dice solo si tiene cliente de Stripe. El contenido del Personalizado ya viaja en `acceso.base`, y sus condiciones en `condiciones`.

### Acciones sobre una persona

`POST /v1/admin/clientes/{id}/personas/{accion}`. Las tres nuevas se suman a `restablecer-mfa`, `borrar-login` y `borrar`, que no cambian.

| Acción | Cuerpo | Permiso | Respuesta 200 |
|---|---|---|---|
| `cambiar-rol` | `{ correo, rol?, admin?, motivo? }`. Al menos uno de `rol` y `admin`. `rol` es texto o `null` (sin rol); `admin` es sí o no | `usuarios: editar` | `{ accion, persona }` |
| `revocar` | `{ correo, motivo? }` | superadministrador | `{ accion, persona }` |
| `reenviar-invitacion` | `{ correo }` | `usuarios: editar` | `{ accion, correoDeInvitacion: 'enviado' \| 'no-enviado' }` |

`persona` es la ficha de siempre (`comoFicha`: correo, rol, admin, estado y fechas).

Rechazos nuevos, con su estado: `cuenta-personal` 409 (estas tres no se hacen en una cuenta personal), `ya-revocado` 409, `ya-entro` 409, `en-pausa` 409, `reenvio-limitado` 429 (con `reintentarEl`), `correo-no-disponible` 409. Los que ya existían: `no-existe` 404, `invalido` 422, `rol-inexistente` 422 (con `roles`), `ultimo-admin` 409, `asiento-revocado` 409, `tope-diario` 429.

### Plan y características

`PATCH /v1/admin/clientes/{id}/condiciones`. Permiso `empresas: editar`.

**Forma nueva:**

```json
{
  "plan": "free" | "personalizado",
  "condiciones": { "contenido": "todo|free|nada", "asientos": 5, "equipo": true, "horarios": true, "hasta": "2027-03-31" | null, "cupos": { "radar": 3 } },
  "motivo": "opcional",
  "soloVer": true,
  "confirmo": true
}
```

- `condiciones` va solo con `personalizado`, y `contenido` es obligatorio ahí. Un campo que no viene se conserva del Personalizado actual (como `planearPersonalizado`).
- `soloVer: true` devuelve la vista previa y no escribe nada.
- `confirmo: true` hace falta para guardar cuando la vista previa trae algo en `confirmar`.

**Respuesta 200:**

```json
{
  "tenantId": "…",
  "soloVer": false,
  "cambio": true,
  "antes":   { "plan": "personalizado", "contenido": "todo", "condiciones": { … } },
  "despues": { "plan": "free", "contenido": null, "condiciones": null },
  "avisos": ["…"],
  "confirmar": ["pierde-condiciones", "pausa-personas", "vacio"],
  "personasEnPausa": 4
}
```

- `plan` es `free`, `personalizado` o el tier estándar que tenga (`pro`, `team`).
- `cambio: false` dice que lo pedido ya era lo que había: no se escribió nada.
- `confirmar` puede traer:
  - `pierde-condiciones`: un Personalizado pasa a Free y se borran sus condiciones y sus reglas de empresa;
  - `pausa-personas`: en Free solo entra una persona, así que las demás quedan en pausa (`personasEnPausa` dice cuántas);
  - `vacio`: contenido «nada» y ninguna regla que dé algo.

**Forma vieja** (`{ asientos, motivo }`): se acepta igual que hoy y responde `{ tenantId, asientos: { antes, despues } }` (decisión 7).

**Rechazos nuevos:** `cuenta-revocada` 409 y `falta-confirmar` 422. Los que siguen: `invalido` 422, `no-existe` 404, `cuenta-con-cobro` 409, `asientos-en-uso` 409 y `plan-rechazado` 422 (con `rechazos`). `cuenta-personal` y `no-es-personalizado` quedan solo para la forma vieja.

## Criterios de aceptación

### Fase 1 · Panel

#### CA-1: Las acciones de la persona en la ficha de una cuenta personal
- **Dado** la ficha de una cuenta personal con su persona
- **Cuando** la abre alguien del equipo
- **Entonces** la tarjeta «Persona» ofrece «Créditos» a quien puede verlos, y «Restablecer verificación en dos pasos» y «Borrar login» solo al superadministrador
- **Y** cada una abre el mismo diálogo y llama al mismo endpoint que en «Usuarios de clientes».

#### CA-2: El tope de la voz en la ficha
- **Dado** un superadministrador en la ficha de una cuenta
- **Entonces** ve el tope de la voz que rige para esa cuenta (su excepción o el general, y cuál de los dos es)
- **Y** un enlace «Cambiar» abre «Voz» con la cuenta ya puesta.
- **Dado** alguien del equipo que no es superadministrador
- **Entonces** no ve esa línea, y la ficha no pide el tope al backend (respondería 403).

#### CA-3: La ficha muestra lo que el backend ya manda
- **Dado** la ficha de una cuenta
- **Entonces** muestra: el vencimiento y su aviso, si tiene cliente de Stripe, cuántos admins tiene, la fecha de creación y, si es personal, de dónde salió.

#### CA-4: El historial muestra el antes y el después
- **Dado** un evento del historial de la cuenta que trae antes y después
- **Entonces** se ven los dos.

#### CA-5: El aviso de borrados a medias dice quién pidió cada uno
- **Dado** un borrado a medias en el aviso de Empresas
- **Entonces** se ve quién lo pidió.

#### CA-6: «Invitar persona» no aparece en una cuenta personal
- **Dado** la página de personas de una cuenta personal
- **Entonces** no está el botón «Invitar persona».

### Fase 2 · Backend: personas

#### CA-7: Cambiar el rol y el admin
- **Dado** una persona con asiento vivo en una empresa
- **Cuando** llega `cambiar-rol` con `rol` y/o `admin`
- **Entonces** se cambia solo lo que vino (`undefined` no toca; `rol: null` deja sin rol)
- **Y** queda en la bitácora de gobierno firmado por «equipo-enso», y en la auditoría del equipo con quién lo hizo, el motivo y el rol y el admin de antes y de después, **sin el correo**.

#### CA-8: El rol tiene que existir y la cuenta no queda sin admin
- **Cuando** el rol no existe en la empresa → `rol-inexistente` con los roles que hay, y no se escribe nada.
- **Cuando** se le quita el admin al último admin → `ultimo-admin`, y no se escribe nada.
- **Cuando** `rol` no es texto ni `null`, o `admin` no es sí o no, o no viene ninguno → `invalido`.

#### CA-9: Quitar el admin invalida la llave de publicación
- **Dado** un admin que deja de serlo (por `cambiar-rol` o por `revocar`)
- **Entonces** la llave de publicación de la empresa queda invalidada, como desde «Mi equipo».

#### CA-10: Revocar
- **Cuando** llega `revocar` sobre una persona con asiento vivo
- **Entonces** su asiento queda `revocado`, se borran sus ajustes, se apaga su llave de la voz y queda en las dos bitácoras (sin correo en la del equipo).
- **Cuando** ya estaba revocada → `ya-revocado`. **Cuando** es la última admin → `ultimo-admin`.

#### CA-11: Reenviar la invitación
- **Dado** una persona `invitada` que todavía no entró
- **Cuando** llega `reenviar-invitacion`
- **Entonces** sale un correo, y se respeta todo lo de «Mi equipo»: máximo 3 correos, una hora entre cada uno (`reenvio-limitado` con `reintentarEl`), el tope diario de la cuenta, y dos pedidos seguidos mandan un solo correo.
- **Cuando** la persona ya entró → `ya-entro`; en pausa → `en-pausa`; revocada → `asiento-revocado`.

#### CA-12: Ninguna de las tres en una cuenta personal
- **Cuando** cualquiera de las tres llega para una cuenta personal → `cuenta-personal`, y no se escribe nada.

#### CA-13: Cada acción con su permiso
- `cambiar-rol` y `reenviar-invitacion`: 403 sin `usuarios: editar`.
- `revocar`, `restablecer-mfa`, `borrar-login` y `borrar`: 403 si no es superadministrador.
- Una persona de otra empresa, o una cuenta fuera del filtro de clientes → `no-existe`.

### Fase 2 · Backend: plan

#### CA-14: La vista previa no escribe nada
- **Cuando** llega `soloVer: true`
- **Entonces** responde el antes, el después, los avisos y lo que hay que confirmar, y la base queda igual.

#### CA-15: Una cuenta personal sigue siendo personal
- **Dado** una cuenta personal
- **Cuando** pasa a Personalizado (o a «Pro»)
- **Entonces** queda con 1 asiento y sin equipo compartido, y sigue siendo personal.
- **Cuando** el pedido trae más de 1 asiento o equipo compartido → `invalido`.

#### CA-16: Un Personalizado vencido se puede extender
- **Dado** un Personalizado con la fecha de fin vencida
- **Cuando** llega una fecha de fin futura, o `hasta: null`
- **Entonces** se guarda.

#### CA-17: Stripe frena el cambio de plan
- **Dado** una cuenta con una suscripción que cobra o puede volver a cobrar (`impideBorrar`)
- **Cuando** pide pasar a Free, o pasar a Personalizado sin serlo
- **Entonces** → `cuenta-con-cobro`, y no se escribe nada.
- **Dado** un Personalizado con precio propio
- **Cuando** cambia sus condiciones
- **Entonces** se permite, como hoy.

#### CA-18: Pasar a Free
- **Dado** un Personalizado (o un Pro o Team que ya no cobra)
- **Cuando** pasa a Free con `confirmo: true`
- **Entonces** queda en tier `free` y paquete `free`, se borran sus condiciones y sus reglas de empresa, y se conservan los roles y los ajustes por persona.
- **Y** en una empresa con más de una persona, todas menos una quedan en pausa (lo mismo que hace hoy el comando), y la vista previa lo dice con `personasEnPausa`.
- **Sin** `confirmo` → `falta-confirmar`.

#### CA-19: Pasar a Personalizado o cambiarlo
- **Cuando** llega `personalizado` con sus condiciones
- **Entonces** se aplica lo que dice `planearPersonalizado` (mismas reglas que el comando: cupos conocidos, fecha futura, paquete publicado, equipo con más de un asiento).
- **Y** quien viene de Free arranca sin reglas de empresa; quien ya era Personalizado conserva las suyas y su paquete (a medida o no).
- **Cuando** `planearPersonalizado` rechaza → `plan-rechazado` con los rechazos en texto.
- **Cuando** quedaría vacío sin `confirmo` → `falta-confirmar`.

#### CA-20: Lo que no cambia no se escribe
- **Cuando** lo pedido es igual a lo que hay
- **Entonces** responde `cambio: false` y no escribe nada, ni en la auditoría.

#### CA-21: Una cuenta revocada no cambia de plan
- **Dado** una cuenta revocada → `cuenta-revocada`.

#### CA-22: La auditoría guarda el antes y el después
- **Cuando** se guarda un cambio de plan
- **Entonces** la auditoría del equipo tiene quién, el motivo, el plan y las condiciones de antes y de después; la bitácora del cliente lo firma «equipo-enso».

#### CA-23: El panel viejo sigue funcionando
- **Cuando** llega `{ asientos, motivo }`
- **Entonces** responde y rechaza exactamente como hoy.

### Fase 2 · Panel

#### CA-24: El menú de cada persona
- **Dado** la página de personas de una empresa
- **Entonces** el menú de cada persona ofrece «Cambiar rol» y «Reenviar invitación» a quien tiene `usuarios: editar`, y «Revocar acceso» solo al superadministrador.
- **Y** «Reenviar invitación» aparece solo en personas `invitadas`; «Cambiar rol» y «Revocar acceso», solo en asientos vivos.
- **Y** en una cuenta personal no aparece ninguna de las tres.

#### CA-25: Cambiar el rol
- **Cuando** elige «Cambiar rol»
- **Entonces** un diálogo ofrece los roles de la empresa (o «sin rol») y la casilla de admin, con el valor actual puesto, y un motivo opcional.

#### CA-26: Revocar avisa que no tiene vuelta directa
- **Cuando** elige «Revocar acceso»
- **Entonces** el diálogo dice que para devolverle el acceso hay que borrarla e invitarla otra vez, y pide confirmar.

#### CA-27: «Cambiar plan» reemplaza a «Cambiar asientos»
- **Dado** la ficha de una cuenta, empresa o personal, para quien tiene `empresas: editar`
- **Entonces** está «Cambiar plan»
- **Y** está desactivado, con el motivo a la vista, si la cuenta tiene una suscripción que cobra o está revocada.

#### CA-28: La pantalla «Cambiar plan»
- **Entonces** ofrece los planes de la decisión 3, y en Personalizado los mismos campos que al crear (`plan-conditions-fields`), con los valores actuales puestos.
- **Y** en una cuenta personal no ofrece asientos ni equipo compartido.
- **Y** tiene dos pasos: «Ver el cambio» muestra el antes, el después, los avisos y lo que hay que confirmar; «Guardar» manda el mismo pedido con `confirmo`.

#### CA-29: Los rechazos se dicen en la pantalla
- **Cuando** el backend rechaza
- **Entonces** el panel muestra el motivo traducido en `app/shared/api/write-mapping.ts`, y el botón queda disponible otra vez.

#### CA-30: Cada botón que manda un pedido se bloquea mientras espera
- Todos los formularios nuevos usan `SubmitButton`.

## Fuera de alcance

- Las fases 3 y 4 del plan (revocar o reactivar una cuenta entera, reglas de acceso, analítica, reanudar la casa, renombrar, el login de Cognito, rotar la llave de licencia).
- El Pro y el Team estándar, el paquete a medida, el precio propio y la suscripción: siguen en `npm run tenant`.
- Cambios en lote.
- ENSŌ: no cambia. El plan, los cupos, el rol, el admin y el estado ya viajan en el manifiesto.

## Plan de pruebas

- **Backend:** un archivo de tests por ruta (`tests/admin-personas-gobierno.test.js` y `tests/admin-cambiar-plan.test.js`), agregados a mano a la lista de `package.json`. Cubren CA-7 a CA-23.
- **Panel:** tests de los lectores y de cada acción contra el doble del backend, más los de visibilidad (CA-6, CA-24, CA-27, CA-28).
- **A mano, después de desplegar:** una empresa y una cuenta personal de prueba. Cambiar el rol, revocar, reenviar, pasar de Free a Personalizado y de vuelta, y abrir ENSŌ con esa cuenta para ver el plan nuevo.
