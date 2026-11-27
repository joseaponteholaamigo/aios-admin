# Spec: Reanudar la casa de una cuenta desde el panel

- **Fecha:** 2026-11-27
- **Origen:** fase 3 del plan `docs/2026-11-26-plan-superadmin-editar-cuentas-y-personas.md` (raíz del workspace). Jose, 2026-11-27: eligió «Reanudar la casa», y que quitar la pausa y descongelar sean dos pasos separados.
- **Estado:** lista para construir con las decisiones de abajo.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en `superadmin_v2`.
- **Despliegues:** al final y los corre Jose. Ningún despliegue le cambia algo a una cuenta que ya existe: solo suma dos rutas y sus funciones.

## Objetivo

Cuando Stripe avisa un reembolso o una disputa, el backend pausa los servicios que paga ENSŌ en esa cuenta y congela lo que quedaba de los créditos de ese pago (CA-32 del reenvío de la casa). Hoy solo lo deshace alguien con `npm run casa -- reanudar`. El superadministrador lo ve y lo deshace desde la ficha de la cuenta.

## Vocabulario

- **La casa:** los servicios que paga ENSŌ y que la app usa a través del backend (el video con IA y Contactos), cobrados en créditos.
- **La pausa:** la marca `pausaReenvio = { desde, motivo, evento }` en la fila de la casa de la cuenta. Con ella, todo pedido nuevo a la casa responde 403 `cuenta-en-revision`. `motivo` es `reembolso` o `disputa`; `evento`, el id del aviso de Stripe.
- **Un lote congelado:** lo que quedaba de los créditos de un pago revertido. No se puede gastar hasta que alguien lo descongela. Lo ya gastado no se recupera.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Dos pasos separados.** «Quitar la pausa» devuelve los servicios y la cuenta sigue con sus otros créditos; los congelados siguen congelados. «Descongelar» es aparte, por lote, para cuando la plata volvió (se ganó la disputa). Tras un reembolso, el lote se queda congelado: esa plata ya se devolvió. | Jose, 2026-11-27 |
| 2 | **Solo el superadministrador**, para ver y para cambiar: toca créditos pagados y los servicios que paga ENSŌ, y la vista nombra a las personas por su correo. | Recomendación |
| 3 | **El motivo es opcional**, como en el resto del panel; sin él, la auditoría anota «desde el panel». | Jose, 2026-11-26 |
| 4 | **Solo un lote de una persona de esa cuenta**, y solo si está congelado. | Regla del panel |
| 5 | **La auditoría del equipo no guarda correos** (sí el id del lote). En las filas de la casa y del lote queda «equipo-enso» como quien lo hizo. | Igual que el resto del panel |

## Superficie de seguridad

| Superficie | ¿La abre? | Detalle |
|---|---|---|
| Endpoint nuevo | Sí, dos | `GET` y `POST /v1/admin/clientes/{id}/casa`, detrás del autorizador y la puerta del equipo, como toda `/v1/admin/*`; los dos solo superadmin |
| Permiso nuevo de una función | Sí, dos funciones | `adminCasa` (GET): lee la tabla del equipo, `tenants` (la ficha, la casa y los asientos) y `creditos` (las billeteras y los lotes). `adminCambiarCasa` (POST): lo mismo, y escribe **solo** la partición `casa` de `tenants` y las particiones `persona:*` y `empresa:*` de `creditos` (la billetera, el lote y, si cambió el mes, la bolsa del mes), con la condición `dynamodb:LeadingKeys`; agrega a la auditoría |
| Dato de cliente nuevo | No | La pausa y los lotes ya existen |
| Recurso nuevo de AWS | Sí, en `AiosAdministrator` | Las dos funciones con sus roles, grupos de logs y filtros, y las dos rutas con sus integraciones, montadas al final para no correr los números de los filtros existentes. `AiosBackend` no cambia |

## Contrato de la API

### `GET /v1/admin/clientes/{id}/casa` · superadmin

```json
{
  "tenantId": "…",
  "pausa": { "desde": "2026-11-20T15:00:00.000Z", "motivo": "reembolso|disputa", "evento": "evt_…" },
  "congelados": [
    { "correo": "ana@acme.com", "lote": "lot_…", "nombre": "Paquete 500", "creditos": 500, "saldo": 300, "vence": "2027-11-20", "congeladoEl": "…", "evento": "evt_…" }
  ]
}
```

- `pausa` es `null` si la cuenta no está en pausa. `congelados` lista los lotes congelados de las personas que tienen asiento en la cuenta (también un asiento revocado), del más viejo al más nuevo. Puede haber pausa sin lotes (un reembolso de Pro) y lotes sin pausa (ya se quitó la pausa).
- `nombre`, `vence`, `congeladoEl` y `evento` pueden venir en `null`.

### `POST /v1/admin/clientes/{id}/casa` · superadmin

```json
{ "accion": "quitar-pausa|descongelar", "correo": "solo para descongelar", "lote": "solo para descongelar", "motivo": "opcional, hasta 500 caracteres" }
```

Responde la misma vista que el GET, ya con el cambio, más `"cambio": true|false` (`false` si ya estaba así: sin pausa, o el lote ya descongelado).

Rechazos: `no-existe` 404 (la cuenta no existe o está fuera del filtro, o ese lote no es de esa persona en esa cuenta), `invalido` 422, `ocupado` 503 (la billetera de la persona cambió varias veces mientras se escribía: se vuelve a intentar).

## Criterios de aceptación

### Backend

- **CA-1:** el GET da la pausa y los lotes congelados de la cuenta, con la persona, lo que queda congelado y el aviso de Stripe; sin pausa ni lotes, `null` y `[]`.
- **CA-2:** `quitar-pausa` deja la casa sin pausa (los pedidos a la casa vuelven a pasar) y no toca ningún lote congelado; la fila anota «equipo-enso» y la hora.
- **CA-3:** `descongelar` deja ese lote gastable otra vez, con su saldo, y no quita la pausa; la fila del lote anota «equipo-enso» y la hora.
- **CA-4:** la auditoría del equipo guarda quién, el motivo y el antes y el después (`casa.quitar-pausa`, `casa.descongelar` con el id del lote), sin correos.
- **CA-5:** pedir lo que ya está → `cambio: false`, sin escribir ni anotar.
- **CA-6:** un lote de otra cuenta, de otra persona o que no existe → `no-existe`, sin escribir.
- **CA-7:** solo el superadmin; con todos los módulos no alcanza (403). Una cuenta fuera del filtro → `no-existe`.
- **CA-8:** un cuerpo con campos de más, sin `accion` válida, o `descongelar` sin correo o sin lote → `invalido`.
- **CA-9:** la función que cambia solo puede escribir la partición `casa` de `tenants` y las particiones `persona:*` y `empresa:*` de `creditos` (`tests/infra-*.test.js`); la que ve no escribe nada.

### Panel

- **CA-10:** en la ficha, solo para el superadmin, y solo si la cuenta está en pausa o tiene lotes congelados, una tarjeta «Servicios de ENSŌ en revisión».
- **CA-11:** la tarjeta dice desde cuándo y por qué está en pausa (reembolso o disputa de Stripe, con el id del aviso) y qué significa (la cuenta no puede usar los servicios que paga ENSŌ), con «Quitar la pausa».
- **CA-12:** la tarjeta lista los lotes congelados (persona, nombre del lote, créditos que quedan congelados, desde cuándo, aviso de Stripe), cada uno con «Descongelar».
- **CA-13:** cada botón abre un diálogo con un motivo opcional que dice qué hace y qué no: quitar la pausa no descongela créditos; descongelar solo corresponde si la plata volvió (se ganó la disputa), y tras un reembolso el lote se deja congelado.
- **CA-14:** después de guardar, la ficha se recarga con un aviso; los rechazos se dicen en el diálogo (`write-mapping.ts`) y el botón vuelve a estar disponible; todo botón que manda un pedido usa `SubmitButton`.
