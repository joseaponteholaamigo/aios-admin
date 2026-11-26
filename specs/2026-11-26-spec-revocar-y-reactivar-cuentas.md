# Spec: Revocar y reactivar una cuenta desde el panel

- **Fecha:** 2026-11-26
- **Origen:** fase 3 del plan `docs/2026-11-26-plan-superadmin-editar-cuentas-y-personas.md` (raíz del workspace). Jose, 2026-11-26: eligió «Revocar y reactivar» como la siguiente pieza.
- **Estado:** lista para construir con las recomendaciones de abajo.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en `superadmin_v2`.
- **Despliegues:** al final y los corre Jose. Ningún despliegue le cambia algo a una cuenta que ya existe: solo suma una ruta y su función.

## Objetivo

El superadministrador le corta todo a una cuenta (empresa o cuenta personal) desde su ficha, con su motivo, y se lo devuelve después, sin pasar por `npm run tenant -- revoke` y sin perder lo que la cuenta tenía.

## Vocabulario

- **Revocar:** la cuenta queda en `status: revoked`. Nadie de la cuenta entra (401); ENSŌ corta lo descargado después de su ventana de 72 h. Ningún aviso de Stripe la deshace. No es vencer: vencer baja a Free y lo produce Stripe o una fecha.
- **Reactivar:** la cuenta vuelve al estado que tenía justo antes de revocarla, que quedó anotado en su bitácora (`detalle.estadoAnterior` del evento `revocado`). Plan, condiciones, reglas de acceso, personas y créditos no se tocan al revocar, así que vuelven tal cual.

## Lo que hay hoy

- Revocar: solo por comando (`revocacion.js#revocarCliente`). Cambia `status` y anota `revocado` con el estado anterior.
- Reactivar: no hay forma limpia. `set-tier` pone `active` pero a un Personalizado le borra sus condiciones y sus reglas; `personalizar` rechaza una cuenta revocada. En el panel, una cuenta revocada no admite ni «Cambiar plan».

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Solo el superadministrador** revoca y reactiva. Revocar corta todo a todas las personas de la cuenta. | Recomendación, igual que revocar a una persona |
| 2 | **El motivo es obligatorio** en las dos acciones: queda en la bitácora del cliente y en la auditoría del equipo. | Como el comando |
| 3 | **Revocar se confirma escribiendo el id exacto de la cuenta**, como «Borrar cuenta». Reactivar no pide escribir nada: devolver el acceso se deshace revocando otra vez. | Recomendación |
| 4 | **No se revoca una cuenta que Stripe puede cobrar** (`compra.js#impideBorrar`): mientras está revocada, el backend ignora los avisos de Stripe, así que seguiría pagando sin acceso y nadie lo vería. Primero se cancela en Stripe. | Misma regla que borrar (Jose, 2026-11-10) |
| 5 | **Reactivar vuelve al estado anterior a la revocación**, no a «activa» a secas: una cuenta que estaba vencida vuelve vencida (Free), no con su plan de pago. Sin dato en la bitácora, vuelve a `active`. | Recomendación |
| 6 | **No se reactiva desde el panel una cuenta cuyo estado recuperado dejaría a Stripe cobrando** (la misma regla 4 sobre el estado que recuperaría). Pasa solo con una cuenta revocada por comando con su suscripción viva: mientras estuvo revocada no se aplicaron los avisos de Stripe, y su plan guardado puede no ser el que paga. Se revisa en Stripe y se reactiva por comando. | Recomendación |
| 7 | **Ante el cliente firma «equipo-enso»**; el motivo real va a la auditoría del equipo. | Igual que el resto del panel |

## Lo que no hace

- **No borra ni libera a nadie.** Las personas siguen atadas a la cuenta revocada y no pueden entrar a otra empresa; para liberarlas, se borra la cuenta.
- **No apaga al instante las llaves de la voz (Teo) ya entregadas.** El barrido diario de la voz borra las de una cuenta que no autoriza; para ya: `npm run casa -- limpiar --si`. Al reactivar, cada persona recibe una llave nueva cuando la pide.
- **No toca ENSŌ:** ENSŌ ya maneja el 401 de una licencia revocada, y vuelve a entrar en la próxima sincronización tras reactivar.

## Superficie de seguridad

| Superficie | ¿La abre? | Detalle |
|---|---|---|
| Endpoint nuevo | Sí, uno | `POST /v1/admin/clientes/{id}/estado`, detrás del autorizador y la puerta del equipo, como toda `/v1/admin/*`; solo superadmin |
| Permiso nuevo de una función | Sí, una función | `adminEstadoDeCuenta`: lee la tabla del equipo y `tenants` (la ficha, sus asientos y su bitácora); escribe en `tenants` **solo** las particiones `tenant` (la ficha) y `eventos:*` (la bitácora del cliente), con la condición `dynamodb:LeadingKeys`; agrega a la auditoría |
| Dato de cliente nuevo | No | `status` y los eventos `revocado` y `reactivado` ya existen |
| Recurso nuevo de AWS | Sí, en `AiosAdministrator` | La función con su rol, su grupo de logs y su filtro, y la ruta con su integración, montadas al final para no correr los números de los filtros existentes. `AiosBackend` no cambia |

## Contrato de la API

### `POST /v1/admin/clientes/{id}/estado` · superadmin

```json
{ "accion": "revocar|reactivar", "motivo": "obligatorio, hasta 500 caracteres", "confirmo": "<id exacto, solo al revocar>", "soloVer": true }
```

Respuesta 200:

```json
{ "tenantId": "…", "accion": "revocar", "soloVer": true, "cambio": true, "estado": { "antes": "active", "despues": "revoked" }, "personas": 4 }
```

- `personas`: cuántas personas de la cuenta pierden el acceso (revocar) o lo recuperan (reactivar): sus asientos que no están revocados.
- `cambio: false` si ya estaba en ese estado (revocar una revocada, reactivar una que no lo está): no escribe ni anota nada.
- `soloVer` no escribe nada y no exige `confirmo`.

Rechazos: `no-existe` 404 (también fuera del filtro de empresas), `invalido` 422, `confirmacion` 422 (revocar sin el id exacto), `cuenta-con-cobro` 409 (Stripe puede cobrar, decisiones 4 y 6), `conflicto` 409 (la ficha cambió cinco veces seguidas mientras se escribía: se vuelve a intentar).

## Criterios de aceptación

### Backend

- **CA-1:** revocar deja `status: revoked`, anota `revocado` en la bitácora del cliente con el estado anterior y firma «equipo-enso»; la auditoría del equipo guarda quién, el motivo y el estado de antes y de después.
- **CA-2:** revocar sin `confirmo` igual al id → `confirmacion`, sin escribir.
- **CA-3:** revocar una cuenta que Stripe puede cobrar → `cuenta-con-cobro`, sin escribir.
- **CA-4:** reactivar vuelve al `estadoAnterior` del último `revocado` (una vencida vuelve `canceled`), anota `reactivado` y la auditoría; sin ese dato, vuelve a `active`.
- **CA-5:** reactivar cuando el estado recuperado dejaría a Stripe cobrando → `cuenta-con-cobro`, sin escribir.
- **CA-6:** revocar y reactivar no tocan plan, condiciones, reglas, asientos ni créditos: después de las dos, la ficha es igual a la de antes salvo el estado.
- **CA-7:** pedir el estado que ya tiene → `cambio: false`, sin escribir ni anotar. `soloVer` no escribe nada.
- **CA-8:** solo el superadmin; un permiso de Empresas o Usuarios no alcanza (403). Una cuenta fuera del filtro → `no-existe`.
- **CA-9:** el motivo es obligatorio en las dos acciones; un cuerpo con campos de más o sin `accion` válida → `invalido`.
- **CA-10:** la función solo puede escribir en las particiones `tenant` y `eventos:*` de `tenants` (`tests/infra-*.test.js`), y su filtro de fallos no corre los números de los existentes.

### Panel

- **CA-11:** la ficha muestra «Revocar cuenta» (superadmin, cuenta no revocada) junto a «Borrar cuenta», y «Reactivar cuenta» (superadmin, cuenta revocada) en el lugar de «Revocar».
- **CA-12:** «Revocar cuenta» abre un diálogo que dice qué pasa (nadie de la cuenta entra; ENSŌ corta lo descargado en 72 h; cuántas personas pierden el acceso; las personas no quedan libres para otra empresa), pide el motivo y el id exacto de la cuenta. Si Stripe puede cobrar (`stripePuedeCobrar`), el botón está desactivado y dice por qué.
- **CA-13:** «Reactivar cuenta» abre un diálogo que dice a qué estado vuelve (de `soloVer`) y cuántas personas recuperan el acceso, y pide el motivo.
- **CA-14:** después de guardar, la ficha se recarga con el estado nuevo y un aviso; los rechazos se dicen en el diálogo (`write-mapping.ts`) y el botón vuelve a estar disponible; todo botón que manda un pedido usa `SubmitButton`.
- **CA-15:** el historial de la ficha nombra los eventos `revocado` y `reactivado` con su motivo.
