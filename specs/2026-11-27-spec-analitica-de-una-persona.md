# Spec: Analítica de una persona desde el panel

- **Fecha:** 2026-11-27
- **Origen:** fase 3 del plan `docs/2026-11-26-plan-superadmin-editar-cuentas-y-personas.md` (raíz del workspace). Jose, 2026-11-27: «Sigamos con analítica».
- **Estado:** lista para construir con las recomendaciones de abajo.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en `superadmin_v2`.
- **Despliegues:** al final y los corre Jose. Ningún despliegue le cambia algo a una cuenta que ya existe: solo suma una ruta y su función.

## Objetivo

Soporte atiende desde el panel el pedido de una persona de dejar de compartir su uso con ENSŌ (o de volver a compartirlo), y ve la prueba de que aceptó los Términos y la Política, sin pasar por `npm run analitica`.

## Vocabulario

- **Analítica:** los errores y el uso de la app que ENSŌ comparte siempre, sin interruptor, según los Términos y la Política que la persona acepta.
- **Dejar de compartir:** la marca `analitica: retirada` en el asiento de la persona. Viaja firmada en el manifiesto (`member.analytics: withdrawn`) y su ENSŌ deja de enviar en la próxima sincronización. Es el derecho a revocar la autorización (Ley 1581 de 2012). No borra lo que ya se envió.
- **Prueba de la aceptación:** una fila por versión de los Términos que la persona aceptó (`terminos:cuenta:<correo>`), con la hora del clic, la del servidor, dónde la aceptó (`registro` o `ventana`) y el nombre que escribió. No se modifica nunca y sobrevive a que la persona salga de la cuenta.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Ver pide `usuarios: ver`; cambiar pide `usuarios: editar`.** Es un pedido de la persona y se deshace volviendo a compartir. | Recomendación |
| 2 | **El correo va en el cuerpo, nunca en la URL**: los registros de acceso guardan la ruta. Ruta propia (`POST …/analitica`) con una función que tiene solo lo justo. | Recomendación |
| 3 | **El motivo es opcional**, como en el resto del panel; sin él, la auditoría anota «desde el panel». | Jose, 2026-11-26 |
| 4 | **Solo sobre una persona de esa cuenta:** el correo tiene que tener su asiento en la cuenta de la ruta. Sirve igual para empresas y cuentas personales. | Regla del panel |
| 5 | **La auditoría del equipo no guarda el correo**, como las demás acciones sobre personas. La bitácora del cliente sí lo nombra (la del comando ya lo hace) y firma «equipo-enso». | Igual que el resto del panel |
| 6 | **No se borra lo ya enviado.** Si la persona pidió además borrar su historial, el diálogo recuerda hacerlo en el proveedor de analítica («Delete person and data», buscando su correo). | Como el comando |

## Superficie de seguridad

| Superficie | ¿La abre? | Detalle |
|---|---|---|
| Endpoint nuevo | Sí, uno | `POST /v1/admin/clientes/{id}/analitica`, detrás del autorizador y la puerta del equipo, como toda `/v1/admin/*` |
| Permiso nuevo de una función | Sí, una función | `adminAnalitica`: lee la tabla del equipo y `tenants` (la ficha, el asiento y la prueba de los términos); escribe en `tenants` **solo** las particiones `asientos:*` (los dos campos de la analítica del asiento) y `eventos:*` (la bitácora del cliente), con la condición `dynamodb:LeadingKeys`; agrega a la auditoría |
| Dato de cliente nuevo | No | La marca y la prueba ya existen. Lo nuevo es que el panel muestra la prueba (fechas, dónde y el nombre que la persona escribió) a quien tiene `usuarios: ver`, que ya ve los correos |
| Recurso nuevo de AWS | Sí, en `AiosAdministrator` | La función con su rol, su grupo de logs y su filtro, y la ruta con su integración, montadas al final para no correr los números de los filtros existentes. `AiosBackend` no cambia |

## Contrato de la API

### `POST /v1/admin/clientes/{id}/analitica`

```json
{ "accion": "ver|retirar|devolver", "correo": "ana@acme.com", "motivo": "opcional, hasta 500 caracteres" }
```

`ver` pide `usuarios: ver`; `retirar` y `devolver`, `usuarios: editar`.

Respuesta 200:

```json
{
  "tenantId": "…",
  "correo": "ana@acme.com",
  "analitica": "compartiendo|retirada",
  "cambiadaEl": "2026-11-27T15:00:00.000Z",
  "terminos": [{ "version": "2026-11", "aceptadoEl": "…", "registradoEl": "…", "donde": "registro|ventana", "nombreDeclarado": "Ana Ruiz" }],
  "cambio": true
}
```

- `cambio` solo viene en `retirar` y `devolver`: `false` si ya estaba así (no escribe ni anota nada).
- `cambiadaEl`: la última vez que cambió su analítica, o `null`.
- En cada aceptación, `aceptadoEl`, `registradoEl`, `donde` y `nombreDeclarado` pueden venir en `null` (una aceptación vieja, o sin nombre escrito); el panel muestra «—».

Rechazos: `no-existe` 404 (la cuenta no existe o está fuera del filtro, o ese correo no tiene asiento en ella), `invalido` 422, `asiento-revocado` 409 (cambiar la analítica de alguien que ya no entra).

## Criterios de aceptación

### Backend

- **CA-1:** `ver` devuelve si comparte, cuándo cambió y la prueba de los términos, de la más vieja a la más nueva; con un asiento revocado también.
- **CA-2:** `retirar` marca el asiento, anota `analitica` en la bitácora del cliente (con el correo, firmado «equipo-enso») y en la auditoría del equipo (sin el correo, con el motivo y el antes y el después). El manifiesto de esa persona lleva `analytics: withdrawn`.
- **CA-3:** `devolver` quita la marca, con las mismas anotaciones.
- **CA-4:** pedir lo que ya está → `cambio: false`, sin escribir ni anotar.
- **CA-5:** un correo sin asiento en esa cuenta (aunque sea de otra) → `no-existe`, sin escribir; un asiento revocado no cambia (`asiento-revocado`).
- **CA-6:** cambiar no toca nada más del asiento: ni el rol, ni el admin, ni su estado.
- **CA-7:** `ver` con `usuarios: ver`; cambiar con `usuarios: editar` (403 sin él). Una cuenta fuera del filtro → `no-existe`.
- **CA-8:** un cuerpo con campos de más, sin `accion` válida, sin correo o con un motivo de más de 500 caracteres → `invalido`.
- **CA-9:** la función solo puede escribir en las particiones `asientos:*` y `eventos:*` de `tenants` (`tests/infra-*.test.js`).

### Panel

- **CA-10:** en la lista de personas de una empresa, el menú de cada persona tiene «Analítica y términos» para quien tiene `usuarios: ver`; en una cuenta personal, la tarjeta «Persona» de la ficha también.
- **CA-11:** el diálogo dice si la persona comparte su uso o no (y desde cuándo), y lista la prueba de cada versión aceptada (versión, fecha del clic, fecha registrada, dónde y el nombre que escribió), o «sin aceptación registrada».
- **CA-12:** quien tiene `usuarios: editar` ve «Dejar de compartir» o «Volver a compartir», con un motivo opcional; al dejar de compartir, el diálogo recuerda que no se borra lo ya enviado y cómo borrarlo en el proveedor de analítica.
- **CA-13:** después de guardar, el diálogo muestra el estado nuevo; los rechazos se dicen en el diálogo (`write-mapping.ts`) y el botón vuelve a estar disponible; todo botón que manda un pedido usa `SubmitButton`.
