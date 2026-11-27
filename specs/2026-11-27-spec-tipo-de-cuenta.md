# Spec: Pasar una empresa a cuenta personal, y al revés, desde el panel

- **Fecha:** 2026-11-27
- **Origen:** fase 3 del plan `docs/2026-11-26-plan-superadmin-editar-cuentas-y-personas.md` (raíz del workspace): «Pasar una empresa a cuenta personal (`npm run cuentas-personales`), y al revés». Jose, 2026-11-27: «arranca con empresa ↔ cuenta personal».
- **Estado:** lista para construir con las decisiones de abajo.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en `superadmin_v2`.
- **Despliegues:** al final y los corre Jose. Ningún despliegue le cambia algo a una cuenta que ya existe: solo suma una ruta y su función.

## Objetivo

Hoy una empresa pasa a cuenta personal solo con `npm run cuentas-personales`, que corre quien tiene acceso al backend. Una cuenta personal pasa a empresa solo sola, cuando su plan llega a admitir más de una persona (`conTipoAlDia`). El superadministrador hace los dos pasos desde la ficha de la cuenta, viendo antes qué cambia.

## Vocabulario

- **Tipo de cuenta:** empresa o cuenta personal. Vive en la ficha (`tipo: 'personal'`; sin el campo es empresa). No viaja en el manifiesto, pero cambia lo que la persona puede hacer (tabla de abajo).
- **Mover:** llevar a la persona de su cuenta personal a una empresa. Al terminar, la cuenta personal se borra. Lo hacen «Unirme» en ENSŌ y «mover» en el panel, y solo con una cuenta personal, nunca con una empresa.

## Qué cambia con el tipo

| | Empresa | Cuenta personal |
|---|---|---|
| Pestaña del panel | «Empresas» | «Cuentas personales» |
| Asientos y rol de la persona desde el panel | Se cambian | No se cambian; «Cambiar plan» solo ofrece un asiento y sin equipo |
| Créditos en ENSŌ | No compra paquetes por Stripe: los carga el superadministrador. Su admin ve los créditos de la empresa | Con Pro, compra paquetes por Stripe |
| Si otra empresa quiere traer a su persona | El correo está «en otra empresa»: no se puede | Con «mover» del panel, o aceptando en ENSŌ la invitación de otra empresa cuando está encendido `AIOS_INVITAR_CUENTAS_PERSONALES`, la persona se va y **esta cuenta se borra** |
| Si la persona borra su propia cuenta | Nadie espera para una cuenta nueva | Su correo espera 24 h |

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Los dos sentidos.** | Plan aprobado por Jose, 2026-11-26 |
| 2 | **Solo el superadministrador.** Cambia lo que la persona puede comprar en ENSŌ y si un «mover» puede borrar la cuenta. | Recomendación |
| 3 | **A cuenta personal, con las reglas del comando y la misma función:** su plan no admite más de una persona y tiene a lo sumo un asiento sin revocar (los invitados y los en espera cuentan). Si no, se niega diciendo cuál falta. | Regla del comando |
| 4 | **A empresa, siempre**, salvo que su persona se esté moviendo a una empresa (la ficha tiene `moviendoA`): el paso que falta del mover borra la cuenta sin mirar el tipo. | Regla nueva |
| 5 | **Vista previa y después guardar, sin escribir el id de la cuenta.** El cambio se deshace con el paso contrario y no corta el acceso a nadie. | Recomendación |
| 6 | **El motivo es opcional**, como en el resto del panel; sin él, la auditoría anota «desde el panel». | Jose, 2026-11-26 |
| 7 | **La auditoría del equipo no guarda correos.** En la bitácora de la cuenta queda el evento `tipo-de-cuenta` con «equipo-enso» como quien lo hizo. | Igual que el resto del panel |

## Superficie de seguridad

| Superficie | ¿La abre? | Detalle |
|---|---|---|
| Endpoint nuevo | Sí, uno | `POST /v1/admin/clientes/{id}/tipo`, detrás del autorizador y la puerta del equipo, como toda `/v1/admin/*`; solo superadmin |
| Permiso nuevo de una función | Sí, una función | `adminTipoDeCuenta`: lee la tabla del equipo y `tenants` (la ficha, la fila del índice y los asientos); escribe en `tenants` **solo** las particiones `tenant` (la ficha), `eventos:*` (la bitácora), `indice-de-cuentas:*` (la fila de la cuenta pasa del índice de un tipo al del otro) y `contadores-de-cuentas`, con la condición `dynamodb:LeadingKeys`; borra solo en `indice-de-cuentas:*`; agrega a la auditoría |
| Dato de cliente nuevo | No | El tipo ya existe |
| Recurso nuevo de AWS | Sí, en `AiosAdministrator` | La función con su rol, su grupo de logs y su filtro, y la ruta con su integración, montadas al final para no correr los números de los filtros existentes. `AiosBackend` no cambia |

## Contrato de la API

### `POST /v1/admin/clientes/{id}/tipo` · superadmin

```json
{ "tipo": "personal|empresa", "motivo": "opcional, hasta 500 caracteres", "soloVer": true }
```

Responde:

```json
{ "tenantId": "…", "soloVer": true, "cambio": true, "tipo": { "antes": "empresa", "despues": "personal" }, "persona": "ana@acme.com" }
```

- `cambio` es `false` si la cuenta ya era de ese tipo; entonces no se escribe ni se anota nada.
- `persona` es el correo del único asiento sin revocar, o `null` si no hay uno solo.
- Con `soloVer` dice lo mismo sin escribir. Una negativa sale igual con `soloVer`, para que la vista previa la muestre.

Rechazos:

- `no-existe` 404: la cuenta no existe o está fuera del filtro.
- `invalido` 422: campos de más, `tipo` que no es uno de los dos, `soloVer` que no es sí o no, motivo largo.
- `plan-de-equipo` 409: su plan admite más de una persona; primero hay que cambiarle el plan.
- `varias-personas` 409: tiene más de un asiento sin revocar.
- `moviendo` 409: su persona se está moviendo a una empresa; al terminar, la cuenta ya no existe.
- `conflicto` 409: la ficha cambió varias veces mientras se guardaba; se vuelve a intentar.

## Criterios de aceptación

### Backend

- **CA-1:** pasar una empresa de una persona a cuenta personal deja la ficha con `tipo: 'personal'`, la cuenta en el índice y el contador de las cuentas personales, y fuera de los de empresas.
- **CA-2:** pasar una cuenta personal a empresa le quita el `tipo` y la mueve al índice y al contador de empresas.
- **CA-3:** `soloVer` responde lo mismo sin escribir ni anotar nada.
- **CA-4:** la auditoría del equipo guarda quién, el motivo y el tipo de antes y de después (`empresas.cambiar-tipo`), sin correos. La bitácora de la cuenta anota `tipo-de-cuenta` con `{ de, a }` y «equipo-enso».
- **CA-5:** pedir el tipo que ya tiene → `cambio: false`, sin escribir ni anotar.
- **CA-6:** a cuenta personal, con un plan de más de una persona → `plan-de-equipo`; con más de un asiento sin revocar → `varias-personas`; los dos sin escribir. Las reglas son las mismas que usa `npm run cuentas-personales`, desde una sola función.
- **CA-7:** a empresa, con un mover en curso → `moviendo`, sin escribir.
- **CA-8:** solo el superadmin; con todos los módulos no alcanza (403). Una cuenta fuera del filtro → `no-existe`.
- **CA-9:** un cuerpo roto → `invalido`.
- **CA-10:** la función solo puede escribir las particiones `tenant`, `eventos:*`, `indice-de-cuentas:*` y `contadores-de-cuentas` de `tenants`, y borrar solo en `indice-de-cuentas:*` (`tests/infra-*.test.js`).

### Panel

- **CA-11:** en la ficha, solo para el superadmin, «Pasar a cuenta personal» en una empresa y «Pasar a empresa» en una cuenta personal.
- **CA-12:** el botón abre un diálogo que pide la vista previa al backend y muestra qué cambia según la tabla «Qué cambia con el tipo»: la pestaña, los créditos en ENSŌ y, al pasar a cuenta personal, que un mover borraría la cuenta. Nombra a la persona si el backend la manda.
- **CA-13:** una negativa de la vista previa se dice en el diálogo, con qué hacer (`plan-de-equipo`: cambiar el plan primero), y no ofrece guardar.
- **CA-14:** guardar lleva un motivo opcional; después, la ficha se recarga con un aviso. Los rechazos se dicen en el diálogo (`write-mapping.ts`) y el botón vuelve a estar disponible. Todo botón que manda un pedido usa `SubmitButton`.
- **CA-15:** el historial de la ficha nombra el cambio de tipo en palabras.

## Fuera de alcance

- **La reserva de la cuenta personal de un correo** (`cuenta-personal-de`) sigue apuntando a la cuenta después de pasarla a empresa. Nadie entra a la empresa por ella (`asegurarCuentaPersonal` lanza antes de sembrar a nadie), pero si esa persona se queda sin asiento vigente:
  - al volver a entrar, ENSŌ no le arma una cuenta Free: responde `cuenta-incompleta` («vuelve a intentarlo»), y el reintento nunca se resuelve;
  - si canjea un código, responde `ya-tienes-cuenta`.

  Pasa igual hoy cuando una cuenta personal cambia a un plan de equipo; si aparece, se arregla para los dos caminos juntos.
- **Las invitaciones en espera** (solo con `AIOS_INVITAR_CUENTAS_PERSONALES` encendido): si la persona de una cuenta personal tenía una invitación de otra empresa y su cuenta pasa a empresa, ENSŌ deja de mostrarla y «Unirme» responde `ya-en-una-empresa`. El asiento invitado sigue ocupando un cupo en la empresa que invitó, y nada lo limpia. Si la cuenta vuelve a ser personal, la invitación reaparece y aceptarla borra la cuenta. Pasa igual con un cambio de plan.
- La persona de la cuenta no se vuelve admin al pasar a cuenta personal: el comando tampoco lo hace.
