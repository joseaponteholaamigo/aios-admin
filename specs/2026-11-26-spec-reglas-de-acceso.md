# Spec: Reglas de acceso de una empresa desde el panel

- **Fecha:** 2026-11-26
- **Origen:** fase 3 del plan `docs/2026-11-26-plan-superadmin-editar-cuentas-y-personas.md` (raíz del workspace). Jose, 2026-11-26: «arranca con las reglas de acceso».
- **Estado:** lista para construir con las recomendaciones de abajo. La decisión 1 se puede cambiar en una línea.
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en `superadmin_v2`.
- **Despliegues:** al final y los corre Jose. Ningún despliegue le cambia algo a una cuenta que ya existe.

## Objetivo

El equipo de ENSŌ da o quita dominios y skills a una empresa Personalizado desde el panel, con la misma vista previa que hoy da `npm run acceso`: qué skills entran y salen, qué agentes y cadenas dejan de estar completos, a cuántas personas les cambia algo y qué reglas de su admin quedan inactivas.

## Vocabulario

- **Contenido de base:** de dónde parte un Personalizado: todo, lo de Free o nada.
- **Regla de empresa:** `dar` o `quitar` sobre un dominio (`dominio:convert`) o una skill (`skill:copy`), encima del contenido de base. Volver a la base borra la regla.
- **Regla inactiva:** una regla `dar` de un rol o de una persona, escrita por el admin del cliente, que apunta a algo que la empresa ya no tiene. No se borra: vuelve a valer si la empresa lo recupera.

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Cambiar las reglas pide `empresas: editar`**, el mismo permiso que «Cambiar plan». Verlas pide `empresas: ver`. Se puede deshacer siempre (volver a la base), por eso no es solo del superadministrador. | Recomendación, 2026-11-26 |
| 2 | **Solo en un Personalizado.** Free, Pro y Team son exactamente lo que se vende (AC-39). En otro plan, la pantalla dice «pásala primero a Personalizado» y enlaza a «Cambiar plan». | Regla del backend (`planearCambioDeAcceso`) |
| 3 | **Las reglas de los roles y las personas no se tocan.** Son del admin del cliente. La vista previa dice cuántas quedan inactivas. | Regla del backend (AC-57) |
| 4 | **Varias a la vez:** se eligen uno o más dominios y skills con una misma acción, como en el comando. | Recomendación |
| 5 | **Nombres visibles con el identificador al lado:** el nombre del dominio y el `label` de la skill salen de `catalogo/latest.json`, el mismo archivo que publica el catálogo público. | Regla del workspace: nombre interno ≠ nombre visible |
| 6 | **Sin correos:** la vista previa da cuántas personas cambian y cuántas reglas quedan inactivas, no quiénes. El permiso es de Empresas, no de Usuarios. | Regla del panel |
| 7 | **Ante el cliente firma «equipo-enso»**, con el motivo «cambio de acceso desde el panel de ENSŌ». El motivo real va a la auditoría del equipo. | Igual que el resto del panel |

## Superficie de seguridad

| Superficie | ¿La abre? | Detalle |
|---|---|---|
| Endpoint nuevo | Sí, dos | `GET` y `POST /v1/admin/clientes/{id}/acceso`, detrás del autorizador y la puerta del equipo, como toda `/v1/admin/*` |
| Permiso nuevo de una función | Sí, dos funciones | `adminAcceso` (GET): lee la tabla del equipo, `tenants` y el bucket de paquetes. `adminCambiarAcceso` (POST): lo mismo, más escribir en `tenants` **solo** las particiones `acceso:*` y `eventos:*` (condición `dynamodb:LeadingKeys`), y agregar a la auditoría |
| Dato de cliente nuevo | No | Las reglas de empresa ya existen |
| Recurso nuevo de AWS | Sí, en `AiosAdministrator` | Las dos funciones con sus roles, grupos de logs y filtros, y las dos rutas con sus integraciones. `AiosBackend` no cambia |

## Contrato de la API

### `GET /v1/admin/clientes/{id}/acceso` · `empresas: ver`

```json
{
  "tenantId": "…",
  "personalizado": true,
  "base": "nada",
  "reglas": [{ "clave": "dominio:convert", "accion": "dar", "inexistente": false, "inactiva": false }],
  "recibe": { "skills": 12, "agentes": 1, "cadenas": 2 },
  "catalogo": {
    "dominios": [{ "slug": "convert", "nombre": { "es": "Convertir", "en": "Convert" }, "skills": 9, "recibe": 9 }],
    "skills": [{ "nombre": "copy", "label": { "es": "…", "en": "…" }, "dominio": "convert", "recibe": true }]
  }
}
```

Rechazos: `no-existe` 404, `sin-catalogo` 503 (no están publicadas las dependencias o la receta del plan).

### `POST /v1/admin/clientes/{id}/acceso` · `empresas: editar`

```json
{ "operaciones": [{ "accion": "dar|quitar|base", "clave": "dominio:convert" }], "motivo": "opcional", "soloVer": true, "confirmo": true }
```

Respuesta 200:

```json
{
  "tenantId": "…", "soloVer": true, "cambio": true,
  "reglas": { "antes": { "dominio:convert": "dar" }, "despues": { } },
  "sale": { "skills": ["copy"], "agentes": ["sales"], "cadenas": [] },
  "entra": { "skills": [], "agentes": [], "cadenas": [] },
  "personasAfectadas": 3,
  "reglasInactivas": 1,
  "confirmar": ["vacio"]
}
```

Rechazos: `no-existe` 404, `no-es-personalizado` 409, `acceso-rechazado` 422 (con `rechazos`: clave que no está en el catálogo, la misma clave con dos acciones), `falta-confirmar` 422, `conflicto` 409 (las reglas cambiaron entre la vista previa y guardar), `sin-catalogo` 503, `invalido` 422.

## Criterios de aceptación

### Backend

- **CA-1:** el GET devuelve la base, las reglas con su estado, cuánto recibe y el catálogo con nombres; sin ningún correo.
- **CA-2:** `soloVer` devuelve qué entra, qué sale, cuántas personas cambian y cuántas reglas quedan inactivas, y no escribe nada.
- **CA-3:** guardar escribe solo la fila `empresa` de sus reglas, con el etag de lo que se leyó; si cambió mientras tanto → `conflicto`, sin pisar nada.
- **CA-4:** las reglas de roles y personas quedan igual.
- **CA-5:** quedar sin ninguna skill exige `confirmo` (`falta-confirmar` sin él).
- **CA-6:** un plan que no es Personalizado → `no-es-personalizado`; una clave fuera del catálogo o con dos acciones → `acceso-rechazado`, sin aplicar ninguna.
- **CA-7:** pedir lo que ya hay → `cambio: false`, sin escribir ni anotar.
- **CA-8:** la auditoría del equipo guarda quién, el motivo y las reglas de antes y de después; la bitácora del cliente firma «equipo-enso».
- **CA-9:** ver pide `empresas: ver` y cambiar `empresas: editar`; una cuenta fuera del filtro → `no-existe`.
- **CA-10:** la función que cambia solo puede escribir en las particiones `acceso:*` y `eventos:*` de `tenants` (`tests/infra-*.test.js`).

### Panel

- **CA-11:** la tarjeta de acceso de la ficha enlaza a «Reglas de acceso» para quien tiene `empresas: editar`; en un plan que no es Personalizado, el enlace lleva a «Cambiar plan» con el motivo a la vista.
- **CA-12:** la pantalla muestra las reglas actuales (con «volver a la base» en cada una) y un formulario para elegir una acción y uno o más dominios o skills, con su nombre visible y el identificador al lado.
- **CA-13:** dos pasos, como «Cambiar plan»: «Ver el cambio» y «Guardar». La vista previa dice qué skills entran y salen, qué agentes y cadenas dejan de estar completos, a cuántas personas les cambia algo y cuántas reglas quedan inactivas.
- **CA-14:** los rechazos se dicen en la pantalla (`write-mapping.ts`) y el botón vuelve a estar disponible; todo botón que manda un pedido usa `SubmitButton`.
