# Spec: Códigos de registro

- **Fecha:** 2026-11-06
- **Origen:** pedido de Jose, 2026-11-06: «desde el superadmin podamos crear un código con el cual los usuarios se pueden registrar […] se debe poder escoger un plan, se debe poder escoger una fecha, un tiempo de expiración y la fecha de límite que va a tener las personas que se registren con ese código». El análisis y las decisiones están en `docs/2026-11-06-plan-codigos-de-registro.md` (raíz del workspace).
- **Estado:** borrador, actualizado el 2026-11-10 con las decisiones 12 a 15
- **Repos:** los tres en la rama `superadmin_v2` (decisión 15): `aios-backend`, `aios-admin` y `aios-tower` (ENSŌ), donde la rama se crea desde `branch-qa`.
- **Depende de:** la mudanza del superadmin a su stack (`specs/2026-11-06-spec-stack-propio-del-superadmin.md`), desplegada el 2026-11-09. Los créditos que da un código (decisión 12) llegan a la persona cuando se mezcle la spec de créditos (`aios-tower-casa/specs/2026-11-10-creditos-por-persona.md`); hasta entonces el código guarda el número y no entrega nada.

## Objetivo

El equipo ENSŌ crea, desde el panel, códigos que reparte en un webinar, un correo o una publicación. Cada persona que usa un código se registra en ENSŌ y queda con su propia cuenta personal en Pro, con la duración que diga el código. Hoy eso exige darle de alta a cada persona a mano (`npm run alta-en-lote`).

## Decisiones

| # | Decisión | Quién y cuándo |
|---|---|---|
| 1 | **Solo cuentas individuales.** Cada persona que canjea recibe su cuenta personal en Pro. Las empresas se siguen creando con «Crear empresa» del panel, y su admin crea a su gente desde Mi equipo. | Jose, 2026-11-06 |
| 2 | **Pro es un Personalizado de una persona** con las condiciones de Pro (`CONDICIONES_PRO` en `src/lib/alta-en-lote.js`): todo el catálogo, un asiento, horarios. No es el plan Pro de Stripe. | Propuesta técnica, sin objeción |
| 3 | **Al terminar el plan del código, la cuenta baja sola a Free**, como todo Personalizado vencido (`vencimientoDe` en `src/lib/plan-efectivo.js`), **y la persona puede comprar Pro ella misma, sobre su misma cuenta** (decisión 13). | Jose, 2026-11-06; la compra, Jose, 2026-11-10 |
| 4 | **Los códigos son solo para personas nuevas.** No canjea un correo que ya está en una empresa o en una cuenta personal (aunque su plan haya vuelto a Free), ni uno cuya cuenta se borró (decisión 14). | Jose, 2026-11-06 y 2026-11-10 |
| 5 | **Módulo `codigos`**, con `ver` y `editar`, asignable desde «Equipo ensō». El superadministrador lo tiene siempre. | Jose, 2026-11-06 |
| 6 | **El código se genera al azar o se escribe a mano.** Uno escrito a mano lleva al menos 8 caracteres (letras, números y guiones, sin distinguir mayúsculas) y siempre tope de usos. | Jose, 2026-11-06 |
| 7 | **Todo código vence en una fecha obligatoria.** Uno generado puede ir sin tope de usos, pero nunca sin fecha: «no puede ser un código infinito». | Jose, 2026-11-06 |
| 8 | **El uso se gasta al canjear, con el correo ya comprobado por Cognito, no al reservar.** Así nadie crea cuentas a nombre de correos ajenos, y la función sin sesión no escribe en la tabla de los clientes. | Propuesta técnica, sin objeción |
| 9 | **Una reserva dura 24 h y cuenta contra el tope mientras está vigente.** Cada reserva habilita un registro, y cada registro manda un correo desde `emails.beenso.com`: así, lo más que un código puede hacer salir es su tope. | Propuesta técnica, sin objeción |
| 10 | **Freno diario por código:** al pasar el máximo de reservas del día, el código se pausa solo y suena una alarma en `aios-alarmas`. El máximo lo fija quien crea el código, y por omisión es 200. | Propuesta técnica, sin objeción |
| 11 | **Los códigos viven en una tabla aparte, `aios-codigos`**, en el stack del backend: el código, sus reservas y sus canjes. La función pública solo toca esa tabla. Va en el backend y no en `AiosAdministrator` porque la usan reservar, canjear y el pre-registro, que son del registro de los clientes. El pre-registro falla cerrado: si la tabla faltara por un problema del stack del superadmin, nadie podría registrarse, ni con invitación. Y así la dependencia sigue en un solo sentido: el superadmin usa lo del backend por nombre, nunca al revés. | Propuesta técnica; Jose preguntó el 2026-11-06 si iba en el stack del superadmin |
| 12 | **Cada código dice cuántos créditos al mes da**, un entero de 0 a 1.000, con 1.000 por omisión. La cuenta creada los guarda (`creditosAlMes`) y la bolsa del mes de esa persona es ese número, no los 1.000 fijos de la regla M4 de la spec de créditos. Al comprar Pro, vuelve a los 1.000 de Pro. Así un código para una promoción abierta puede salir barato: cada crédito se paga en OpenRouter. | Jose, 2026-11-10 (opción B) |
| 13 | **Comprar Pro desde una cuenta de código.** «Comprar Pro» aparece desde el aviso de 30 días antes del fin y después de vencido. Al confirmarse el pago, la cuenta deja de ser Personalizado y queda en el Pro de Stripe, con su mismo id, su persona y lo que tenga. Si paga antes del fin, Stripe empieza a cobrar el día siguiente a `hasta` (`subscription_data.trial_end`), para que no pierda los días gratis. Si faltan menos de 48 h, el mínimo que acepta Stripe, cobra al pagar. Solo pueden comprar así las cuentas que salieron de un código (`origen: 'codigo'`): las del webinar no tienen fin y no lo necesitan. | Jose, 2026-11-10 (la compra); el cómo, propuesta técnica |
| 14 | **Una huella del correo al borrar.** Al borrar una cuenta o una persona, se borra su correo, pero queda en `aios-codigos` una huella: un HMAC-SHA256 del correo normalizado, con una clave que genera el stack en Secrets Manager y no sale de AWS. Con ella el canje reconoce a quien ya tuvo cuenta (decisión 4), y nadie puede averiguar un correo probando candidatos. En el detalle de un código, el canje de una cuenta borrada dice «cuenta borrada», sin correo. | Jose, 2026-11-10 (solo personas nuevas); la huella, propuesta técnica |
| 15 | **Las ramas son las del superadmin**, `superadmin_v2`, en los tres repos. En `aios-tower` se crea desde `branch-qa`, en un worktree aparte, para no cambiar la copia en la que corre el ENSŌ de desarrollo. | Jose, 2026-11-10 |

## Alcance

- **Backend (`aios-backend`):**
  - La tabla `aios-codigos`, con `RETAIN`, protección contra borrado y PITR, en la política de stack del backend. Guarda tres clases de fila: el código, la reserva de un correo y el canje de un correo.
  - `POST /v1/codigos/reservar`, sin sesión.
  - `POST /v1/codigos/canjear`, con la sesión de la persona (su token de identidad).
  - El pre-registro de Cognito deja pasar también a un correo con reserva vigente.
  - La API de admin, en el stack `AiosAdministrator`:
    - `GET /v1/admin/codigos` (lista);
    - `POST /v1/admin/codigos` (crear);
    - `GET /v1/admin/codigos/{codigo}` (detalle, con reservas vigentes y canjes);
    - `POST /v1/admin/codigos/{codigo}/estado` (pausar, reanudar, revocar).
  - El módulo `codigos` en los permisos del equipo.
  - La auditoría: crear, pausar, reanudar y revocar quedan en `eventos`; cada canje, en la bitácora de la cuenta creada.
  - El freno diario, con su marcador en `src/lib/alert-markers.js` y su alarma en el stack del backend.
  - Los créditos al mes de cada código, guardados en la cuenta que crea (decisión 12).
  - Comprar Pro desde una cuenta de código: la regla de compra, el checkout con `trial_end` y el webhook que la pasa de Personalizado a Pro (decisión 13).
  - La huella del correo al borrar una cuenta o una persona, desde el panel o por comando, y la clave del HMAC (decisión 14).
- **Panel (`aios-admin`):**
  - El módulo «Códigos»: la lista, el formulario de crear (con el botón compartido `app/shared/ui/submit-button.tsx` y su clave contra el doble envío) y el detalle con sus acciones.
  - El campo «Créditos al mes» en el formulario, la lista y el detalle.
  - La entrada en el menú y en el editor de permisos de «Equipo ensō».
- **ENSŌ (`aios-tower`):**
  - El diálogo «Tengo un código» (`web/shared/codigo/`), en español e inglés, y el servicio que reserva y canjea (`server/services/codigo-de-registro.js`).
  - Sus entradas: «Tu cuenta» (`web/shared/cuenta/`), adonde lleva el chip «entrar» del pie, y el modal de bienvenida (`web/modules/enso/enso-bienvenida.html`).
  - El canje automático al volver con la sesión, y los mensajes de resultado y de error.
  - «Comprar Pro» en el aviso de fin del plan y en «Tu plan venció», para una cuenta de código, en lugar de «Contactar» (`web/shared/plan/`).

## Fuera de alcance

- Códigos de empresa: una empresa se crea con «Crear empresa» (decisión 1).
- Comprar Pro desde una cuenta Personalizado que no salió de un código, como las del webinar (decisión 13).
- Huellas de las cuentas y personas borradas antes de que esto se despliegue: no quedó nada de qué sacarlas.
- Códigos de Free: ENSŌ ya funciona en Free sin cuenta.
- Un enlace que abra ENSŌ con el código puesto (`enso://…`).
- Mostrar en la ficha de una cuenta de qué código salió: el detalle del código ya dice quién lo usó.
- Que el admin de una empresa cree sus propios códigos.
- Mandar un correo propio al canjear: Cognito ya manda el de verificación.

## Criterios de aceptación

### Panel y API de admin

### CA-1: Crear un código generado
- **Dado** una persona del equipo con `codigos: editar`
- **Cuando** crea un código con:
  - código generado al azar;
  - etiqueta «Webinar de noviembre»;
  - válido desde ahora hasta dentro de 2 días;
  - sin tope;
  - el Pro dura 2 meses desde el canje;
  - sin tocar «Créditos al mes»
- **Entonces** el backend guarda el código en `aios-codigos` con estado `activo`, 0 usos, 1.000 créditos al mes y el freno diario en 200
- **Y** el código tiene 12 caracteres al azar, de un alfabeto sin letras que se confunden, agrupados como `ENSO-XXXX-XXXX-XXXX`
- **Y** la auditoría tiene `codigos.crear` con el actor `equipo:<sub>` y la etiqueta, sin correos de clientes.

### CA-2: Crear un código escrito a mano
- **Dado** la misma persona
- **Cuando** escribe `webinar-nov`, con tope de 300 y vencimiento
- **Entonces** el código queda guardado como `WEBINAR-NOV`
- **Y** se rechaza con 422, sin guardar nada, si:
  - tiene menos de 8 caracteres;
  - lleva algo distinto de letras, números y guiones;
  - no tiene tope
- **Y** se rechaza con 409 (`codigo-existe`), sin guardar nada, si ya existe un código con ese texto, sin importar mayúsculas.

### CA-3: Las fechas y la duración del plan
- **Dado** el formulario de crear
- **Entonces** «válido hasta» es obligatorio y «válido desde» es opcional (por omisión, ahora)
- **Y** la duración del plan es una de tres:
  - N días o N meses desde el canje;
  - hasta una fecha fija (`AAAA-MM-DD`);
  - sin fin
- **Y** las dos fechas del código van con su zona horaria (`2026-11-30T23:59:00-05:00`): sin ella, en producción el código vencería cinco horas antes
- **Y** se rechaza con 422 si:
  - una fecha no trae zona, o no existe en el calendario (`2026-11-31`);
  - «válido hasta» ya pasó, es anterior a «válido desde» o está a más de 1.095 días: ningún código es infinito;
  - la fecha fija del plan ya pasó o es anterior al último día en que se puede canjear (el de Bogotá 24 h después de «válido hasta», CB-5);
  - N no es un entero entre 1 y 36 (meses) o entre 1 y 1095 (días);
  - «Créditos al mes» no es un entero entre 0 y 1.000.

### CA-4: La lista y el detalle
- **Dado** una persona con `codigos: ver`
- **Cuando** abre «Códigos»
- **Entonces** ve cada código con:
  - código, etiqueta y duración del plan;
  - créditos al mes;
  - vigencia (desde y hasta);
  - usos, como «37 de 300» o «37, sin tope»;
  - reservas vigentes;
  - estado: activo, pausado, revocado, vencido, agotado o todavía no empieza
- **Y** en el detalle, la lista de canjes: correo, fecha y la cuenta creada, con enlace a su ficha
- **Y** el canje de una cuenta que se borró dice «cuenta borrada», con su fecha y sin correo ni enlace (decisión 14).

### CA-5: Pausar, reanudar y revocar
- **Dado** una persona con `codigos: editar` y un código activo
- **Cuando** lo pausa
- **Entonces** reservar responde «código pausado» hasta que lo reanude
- **Y** reanudarlo reinicia el freno del día: si lo había pausado el freno, la reserva siguiente no lo vuelve a pausar
- **Y** cuando lo revoca, ya no se puede reanudar, y quienes lo canjearon conservan su plan
- **Y** cada acción queda en la auditoría (`codigos.pausar`, `codigos.reanudar`, `codigos.revocar`).

### CA-6: Los permisos
- **Dado** una persona del equipo sin el módulo `codigos`
- **Entonces** el menú no muestra «Códigos» y cada ruta de `/v1/admin/codigos*` le responde 403
- **Y** con `ver` puede leer y no crear ni cambiar (403 en las de escritura)
- **Y** el superadministrador puede todo sin tener el módulo asignado.

### CA-7: Crear dos veces es crear uno
- **Dado** el formulario de crear, con su clave
- **Cuando** se envía dos veces, por doble clic o por reintento
- **Entonces** existe un solo código, y el segundo envío recibe el mismo resultado.

### Reservar y registrarse

### CA-8: Reservar un código vigente
- **Dado** `WEBINAR-NOV` activo, dentro de su vigencia y con usos libres
- **Cuando** ENSŌ manda `POST /v1/codigos/reservar` con el código (sin importar mayúsculas ni espacios) y un correo
- **Entonces** responde 200 con lo que da el código y cuándo vence la reserva (`{ daCodigo: { plan: 'pro', duracion: { meses: 2 }, creditosAlMes: 1000 }, vence }`; la duración puede ser la fecha fija o sin fin)
- **Y** guarda la reserva del correo, que vence a las 24 h y cuenta contra el tope mientras está vigente.

### CA-9: Reservar no dice si el correo ya tiene cuenta
- **Dado** un correo con cuenta y otro sin cuenta
- **Cuando** los dos reservan el mismo código vigente
- **Entonces** las dos respuestas son iguales: el «ya tienes cuenta» sale al canjear, y solo a quien entró con ese correo.

### CA-10: El pre-registro deja pasar a quien reservó
- **Dado** un correo sin asiento y con una reserva vigente
- **Cuando** se registra en Cognito, con contraseña o con Google o Microsoft
- **Entonces** el pre-registro lo deja pasar
- **Y** un correo sin asiento y sin reserva vigente sigue rechazado con `MENSAJE_SIN_ASIENTO` (`src/lib/pre-registro.js`).

### Canjear

### CA-11: El canje crea la cuenta personal en Pro
- **Dado** una persona que acaba de registrarse y entrar, con su token de identidad (correo verificado), y una reserva vigente de `WEBINAR-NOV`
- **Cuando** ENSŌ manda `POST /v1/codigos/canjear`
- **Entonces** el backend gasta un uso del código y crea una cuenta:
  - personal (`tipo: 'personal'`), cuyo nombre es el correo;
  - Personalizado con las condiciones de Pro y la fecha de fin del código;
  - con `origen: 'codigo'` y los créditos al mes del código (`creditosAlMes`);
  - con la persona como su admin
- **Y** borra la reserva y guarda el canje (correo, fecha, id de la cuenta)
- **Y** la bitácora de la cuenta dice que se creó con un código, con la persona como actor
- **Y** el manifest siguiente de esa persona trae Pro con su fecha de fin (`plan.hasta`).

### CA-12: La fecha de fin del plan
- **Dado** un canje el 2026-11-06 (fecha de Bogotá)
- **Entonces** «2 meses desde el canje» da `hasta: 2027-01-06`, «30 días» da `2026-12-06`, una fecha fija da esa fecha y «sin fin» no pone `hasta`
- **Y** el día siguiente a `hasta`, la cuenta está en Free (`planEfectivo`), y ENSŌ muestra «Tu plan venció» con «Comprar Pro» (CA-18).

### ENSŌ

### CA-13: Las entradas a «Tengo un código»
- **Dado** una persona sin sesión en ENSŌ
- **Entonces** ve «Tengo un código» en el modal de bienvenida y en «Tu cuenta» (Ajustes → Mi plan), adonde lleva el chip «entrar» del pie, y las dos abren el diálogo «Tengo un código»
- **Y** con sesión ninguna lo muestra.

Es un diálogo dentro de ENSŌ y no una página aparte como `/gracias`: `/gracias` la abre el navegador cuando Stripe redirige, y quien tiene un código ya está dentro de ENSŌ.

### CA-14: El recorrido en «Tengo un código»
- **Dado** el diálogo abierto
- **Cuando** la persona escribe el código y su correo, y pulsa continuar
- **Entonces** ENSŌ reserva antes de abrir Cognito:
  - si reservar rechaza, muestra el motivo en la misma página y no abre nada;
  - si sirve, muestra lo que da («Pro gratis por 2 meses, con 1.000 créditos al mes»; sin la parte de los créditos si el código da 0), avisa que hace falta una app de autenticación, como `/gracias`, y abre la entrada de Cognito con el correo (`login_hint`)
- **Y** al volver la sesión, canjea solo y muestra «Listo: tienes Pro hasta el 6 de enero de 2027», o «sin fecha de fin»
- **Y** el botón queda bloqueado, con «Comprobando…» y `aria-busy="true"`, mientras reserva.

### CA-15: Los mensajes, en los dos idiomas
- **Dado** cada respuesta de error de reservar y canjear (CB-1, CB-2, CB-4, CB-5, CB-14)
- **Entonces** ENSŌ muestra un mensaje propio en español y en inglés (`locales/es.json`, `locales/en.json`), sin códigos internos
- **Y** ningún error deja a la persona esperando: hoy un rechazo de Cognito la deja 10 minutos en «Termina de entrar en el navegador…».

### Infraestructura

### CA-16: Cada pieza en su stack, con lo justo
- **Dado** las plantillas sintetizadas de los dos stacks
- **Entonces** el backend tiene la tabla `aios-codigos` (`RETAIN`, protección contra borrado, PITR), nombrada en `infra/stack-policy.json`
- **Y** la función de reservar solo puede leer y escribir `aios-codigos`, y agregar a `eventos` la pausa del freno del día: ni `tenants`, ni buckets, ni correo
- **Y** su ruta tiene su propio freno en API Gateway (5 por segundo, picos de 10), declarado en la forma que CloudFormation aplica (CB-11)
- **Y** la de canjear puede escribir en `aios-codigos` y en `tenants`, agregar a `eventos` y leer la clave del HMAC
- **Y** el pre-registro puede además leer `aios-codigos`
- **Y** las funciones de admin de códigos (stack `AiosAdministrator`) usan `aios-codigos` y `eventos` por nombre, sin exports
- **Y** las de borrar una cuenta y las acciones sobre una persona pueden además escribir en `aios-codigos` y leer la clave del HMAC, y nada más de lo nuevo
- **Y** cada stack sigue con 450 recursos o menos.

### CA-17: El freno diario
- **Dado** un código con freno de 200 reservas por día
- **Cuando** llega la reserva 201 del mismo día (Bogotá)
- **Entonces** se rechaza, el código pasa a `pausado` con el motivo «freno diario», y el log de la función escribe el marcador del freno, sin el correo
- **Y** suena la alarma `aios-codigo-frenado`, cuya descripción dice cómo reanudarlo desde el panel
- **Y** las reservas que ya estaban se pueden seguir canjeando.

### Después del código

### CA-18: Comprar Pro desde una cuenta de código
- **Dado** una cuenta creada por un código, con `hasta: 2027-01-06`
- **Cuando** faltan 30 días o menos, o ya venció
- **Entonces** ENSŌ muestra «Comprar Pro» en el aviso de fin y en «Tu plan venció», y el checkout se abre sobre la misma cuenta (`decidirCompra` no responde `contactar`)
- **Y** si paga el 2026-12-20, la suscripción de Stripe empieza a cobrar el 2027-01-07 (`trial_end`), y hasta ese día sigue con el plan del código
- **Y** al confirmarse el pago, el webhook la pasa al Pro de Stripe: deja de ser Personalizado (sin `plan: 'personalizado'` ni `condiciones`), conserva su id, su persona, su `tipo: 'personal'` y su capa de equipo, y su bolsa del mes vuelve a 1.000
- **Y** la bitácora de la cuenta dice que pasó del código a Pro.

### CA-19: La huella al borrar
- **Dado** una cuenta personal creada por un código, o una persona de una empresa
- **Cuando** se borra la cuenta desde el panel o por comando, o se borra a la persona («Borrar persona»)
- **Entonces** `aios-codigos` guarda una huella por cada correo borrado: el HMAC-SHA256 del correo normalizado, con su fecha y sin el correo
- **Y** los canjes de esa cuenta en `aios-codigos` pierden el correo y quedan como «cuenta borrada»
- **Y** si la huella no se pudo escribir, el borrado no sigue y responde un error que se puede reintentar, como cualquier borrado a medias.

### CA-20: Los créditos al mes de la cuenta
- **Dado** un código con 300 créditos al mes y la spec de créditos ya mezclada
- **Cuando** una persona lo canjea el 2026-11-15
- **Entonces** su bolsa de noviembre es de 300 (como la regla M5: quien llega a mitad de mes recibe la del mes), y el 1 de diciembre vuelve a 300
- **Y** con un código de 0 créditos, Contenido y Contactos le muestran que no tiene saldo, como a quien gastó todo.

## Casos borde y de error

### CB-1: Un código que no sirve
- **Dado** un código que no existe, vencido, que todavía no empieza, pausado, revocado o agotado (usos más reservas vigentes ≥ tope)
- **Cuando** se reserva
- **Entonces** responde con el motivo (`no-existe`, `vencido`, `todavia-no`, `pausado`, `revocado`, `agotado`) y no escribe nada.

### CB-2: Quien ya tiene cuenta
- **Dado** un correo que ya está en una empresa o en una cuenta personal (vigente o vencida), o que tiene una huella porque su cuenta o su persona se borró (CA-19)
- **Cuando** canjea
- **Entonces** responde `ya-tienes-cuenta`, no gasta uso, borra su reserva, y su cuenta no cambia
- **Y** la huella reconoce el correo aunque llegue con otras mayúsculas o con espacios.

### CB-3: El último uso, pedido dos veces a la vez
- **Dado** un código con un solo uso libre y dos canjes simultáneos de correos distintos
- **Entonces** uno crea su cuenta y el otro recibe `agotado`, sin pasarse del tope.

### CB-4: La reserva venció
- **Dado** una reserva de hace más de 24 h
- **Entonces** el pre-registro rechaza ese correo como sin asiento
- **Y** si la persona ya tenía cuenta en Cognito y entra, canjear responde `sin-reserva`, y ENSŌ le pide escribir el código de nuevo.

### CB-5: El código cambió entre la reserva y el canje
- **Dado** una reserva vigente
- **Cuando** el código se pausa o se revoca antes del canje
- **Entonces** el canje responde `pausado` o `revocado`, y no crea nada
- **Y** si en cambio el código solo **venció** en ese lapso, el canje se hace: la persona reservó a tiempo.

### CB-6: Reservar dos veces
- **Dado** un correo con una reserva vigente
- **Cuando** reserva de nuevo, con el mismo código o con otro
- **Entonces** queda una sola reserva, la última, y cuenta una sola vez contra el tope del código que tenga.

### CB-7: Un canje cortado a mitad
- **Dado** un canje que se cortó después de gastar el uso y antes de terminar la cuenta
- **Cuando** ENSŌ vuelve a canjear con el mismo correo
- **Entonces** termina lo que faltó sobre la misma cuenta, no gasta otro uso y no crea una segunda cuenta.

### CB-8: Canjear sin reserva
- **Dado** una persona con sesión, sin cuenta y sin reserva
- **Cuando** ENSŌ canjea
- **Entonces** responde `sin-reserva` y no escribe nada.

### CB-9: Un token que no sirve
- **Dado** un canje sin token, con un token vencido, de otro pool, o con el correo sin verificar
- **Entonces** responde 401 y no escribe nada.

### CB-10: Entradas mal formadas
- **Dado** un reservar con un código de forma imposible (vacío, más de 40 caracteres, otros símbolos) o un correo sin forma de correo
- **Entonces** responde 422 sin leer la tabla.

### CB-11: Probar códigos a ciegas
- **Dado** muchos pedidos a `POST /v1/codigos/reservar`
- **Entonces** la ruta tiene su propio freno en API Gateway, más bajo que el del resto (por ejemplo 5 por segundo, con picos de 10), y los rechazos de CB-1 no escriben nada
- **Y** adivinar un código generado de 12 caracteres al azar no es viable con ese freno.

### CB-12: El Pro no está publicado
- **Dado** que no está publicado el paquete `pro` para el tier `pro`
- **Cuando** alguien canjea
- **Entonces** responde un error de servicio, no gasta uso, conserva la reserva y lo deja en el log.

### CB-13: Datos inválidos al crear
- **Dado** el formulario de crear con fechas inválidas, una duración fuera de rango, un tope de 0 o negativo, o un freno de 0 o negativo
- **Entonces** responde 422 con el campo en falta, y no guarda nada.

### CB-14: Revocar un código ya usado
- **Dado** un código con 37 canjes
- **Cuando** se revoca
- **Entonces** las 37 cuentas conservan su plan y su fecha de fin
- **Y** las reservas vigentes ya no se pueden canjear (CB-5).

### CB-15: La persona cierra ENSŌ entre el registro y el canje
- **Dado** una persona que se registró con una reserva vigente y cerró ENSŌ antes de volver
- **Cuando** abre ENSŌ y entra
- **Entonces** ENSŌ canjea en la primera entrada en que el backend responda que no tiene cuenta, mientras la reserva siga vigente.

### CB-16: Comprar a menos de 48 h del fin
- **Dado** una cuenta de código cuyo `hasta` es mañana
- **Cuando** compra Pro
- **Entonces** el checkout va sin `trial_end`, Stripe cobra al pagar, y la cuenta pasa a Pro al confirmarse el pago.

### CB-17: Una cuenta Personalizado que no salió de un código
- **Dado** una cuenta del webinar o una empresa Personalizado, sin `origen: 'codigo'`
- **Cuando** pide comprar Pro
- **Entonces** sigue respondiendo `contactar`, como hoy, y el webhook sigue sin cambiarle el plan (AC-43).

### CB-18: Pagar dos veces
- **Dado** una cuenta de código que ya pasó a Pro
- **Cuando** vuelve a pedir el checkout
- **Entonces** responde `usa-el-portal`, como toda cuenta con una suscripción que cobra (`sigueCobrando`).

### CB-19: Borrar una cuenta de código que ya es Pro
- **Dado** una cuenta de código que compró Pro y sigue cobrando
- **Cuando** el superadmin la quiere borrar
- **Entonces** el borrado se frena como el de cualquier cuenta con suscripción viva (`impideBorrar`).

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-2, CA-3, CB-13 | unit de la validación + integración del handler | `aios-backend/tests/admin-codigos.test.js` (nuevo) |
| CA-4, CA-5, CB-14 | integración de los handlers de admin con motores en memoria | `aios-backend/tests/admin-codigos.test.js` |
| CA-6 | integración de la puerta del equipo | `aios-backend/tests/admin-permisos-por-ruta.test.js`, `aios-admin/tests/` (menú y rutas) |
| CA-7 | integración con la clave repetida | `aios-backend/tests/admin-codigos.test.js` |
| CA-8, CA-9, CB-1, CB-6, CB-10 | integración del handler de reservar | `aios-backend/tests/codigos-reservar.test.js` (nuevo) |
| CA-10, CB-4 | unit del trigger | `aios-backend/tests/pre-registro.test.js` |
| CA-11, CA-12, CB-2, CB-5, CB-7, CB-8, CB-9, CB-12 | integración del handler de canjear | `aios-backend/tests/codigos-canjear.test.js` (nuevo) |
| CB-3 | integración con dos canjes a la vez | `aios-backend/tests/codigos-canjear.test.js` |
| CA-16, CB-11 | síntesis de las plantillas | `aios-backend/tests/infra-stack.test.js`, `tests/infra-equipo.test.js`, `tests/nombres-desplegados.test.js` |
| CA-17 | integración del handler + síntesis de la alarma | `aios-backend/tests/codigos-reservar.test.js`, `tests/infra-stack.test.js` |
| CA-18, CB-16, CB-17, CB-18 | unit de la regla de compra + integración del checkout y del webhook | `aios-backend/tests/compra-con-sesion.test.js`, `tests/personalizado-webhook.test.js`, `tests/checkout-portal.test.js` |
| CA-19, CB-19 | integración de los borrados con motores en memoria | `aios-backend/tests/admin-borrar-cuenta.test.js`, `tests/admin-acciones-persona.test.js`, `tests/codigos-canjear.test.js` |
| CA-20 | integración de la bolsa del mes (cuando la spec de créditos esté mezclada) | `aios-backend/tests/creditos.test.js` |
| CA-4, CA-5, CA-7 (panel) | componentes y rutas | `aios-admin/tests/` (módulo nuevo) |
| CA-13, CA-14, CA-15, CB-15 | rutas del servidor local + página | `aios-tower/tests/` (nuevo, con el backend falso) |
| De punta a punta | manual | Jose, en producción: un código de prueba, una cuenta nueva con Google y otra con contraseña, en la app empaquetada de macOS y de Windows |

## Archivos probablemente afectados

**Backend (`aios-backend`)**
- `src/lib/codigos.js` (nuevo): las reglas del código, de la reserva, del canje y del freno, sin I/O donde se pueda.
- `src/handlers/codigos.js` (nuevo): reservar y canjear.
- `src/handlers/admin-codigos.js` (nuevo): la API de admin.
- `src/lambda.js`: las rutas nuevas en `RUTAS` y `RUTAS_ADMIN`.
- `src/lib/pre-registro.js`: asiento **o** reserva vigente.
- `src/lib/entitlements.js`: una función que verifica el token y devuelve el correo aunque la persona no tenga asiento (hoy queda adentro de `resolverPorToken`).
- `src/lib/storage.js`: `TABLES.codigos`.
- `src/lib/admin/permisos-del-equipo.js`: el módulo `codigos` en `MODULOS`.
- `src/lib/admin/rutas-de-escritura.js`: los estados HTTP de los errores nuevos.
- `src/lib/alert-markers.js`: el marcador del freno.
- `src/lib/compra.js`: `decidirCompra` deja comprar a una cuenta con `origen: 'codigo'` (CA-18).
- `src/handlers/checkout.js`: `subscription_data.trial_end` cuando faltan 48 h o más para `hasta`.
- `src/lib/webhooks.js`: el pago de una cuenta de código la pasa de Personalizado a Pro; las demás siguen como hoy (AC-43).
- `src/lib/admin/borrar-cuenta.js`, `src/lib/admin/acciones-sobre-persona.js` y `src/lib/borrado.js`: la huella antes de borrar y los canjes como «cuenta borrada» (CA-19).
- `src/lib/creditos.js` (de la spec de créditos): la bolsa del mes lee `creditosAlMes` de la cuenta (CA-20).
- `infra/aios-stack.js`: la tabla, la función pública con su freno de ruta, la de canjear, el permiso del pre-registro y la alarma.
- `infra/equipo.js`: las funciones y rutas de admin de códigos.
- `infra/stack-policy.json`: la tabla nueva.
- `package.json`: los archivos de test nuevos en `npm test`.
- `docs/INFRAESTRUCTURA.md`, `docs/MODELO-DE-DATOS.md`, `docs/COMANDOS-SUPERADMIN.md`.

**Panel (`aios-admin`)**
- `app/domain/permissions.ts`: el módulo `codes` (en inglés en el panel; `codigos` en el backend).
- `app/shared/routing/route-table.ts`: las rutas `codes`, `codes/new` y `codes/:code`, con su acceso.
- `app/modules/codes/` (nuevo): la lista, el formulario, el detalle y sus componentes.
- `app/shared/api/`: la traducción de los nombres del backend (`codes-mapping.ts`) y las llamadas de lectura y escritura.
- `app/modules/team/`: el módulo nuevo en el editor de permisos.

**ENSŌ (`aios-tower`)**
- `web/codigo/` (nuevo) o junto a `web/compra/`: la página `/codigo`.
- `server/routes/` (nuevo `codigo.js`, o en `compra.js`/`activacion.js`): las llamadas a reservar y canjear, por el servidor local (la CSP solo permite `connect-src 'self'`).
- `server/services/local-api-token-routes.js`: las rutas de la página en el token acotado.
- `server/services/login-de-persona.js` y `server/routes/auth.js`: abrir la entrada con el correo y canjear al volver la sesión.
- `web/shared/cuenta/`, `web/modules/enso/enso-bienvenida.html`, `web/shared/footbar/footbar.html`: las tres entradas.
- `web/shared/plan/`: «Comprar Pro» en lugar de «Contactar» para una cuenta de código (CA-18).
- `locales/es.json`, `locales/en.json`.

## Riesgos y preguntas abiertas

- **Los créditos dependen de otra rama.** La bolsa del mes vive en la spec de créditos (`feat/backend-casa-teo`), que todavía no está en `branch-qa`. Esa spec fija 1.000 para todos (M4) y tiene que leer `creditosAlMes` de la cuenta. Si los códigos salen antes, el número queda guardado y los créditos llegan con esa mezcla.
- **La clave del HMAC no se puede perder ni cambiar:** con otra clave, las huellas viejas dejan de reconocer a nadie. La genera el stack del backend dentro de Secrets Manager (`aios/huella-de-correo`, con `RETAIN` y en la política del stack): nadie la escribe ni la ve, y nunca pasa por el repo.

- **El formulario de registro de Cognito con el correo puesto.** Hoy `login_hint` no rellena el registro (`server/services/login-de-persona.js:146-149`). Hay que probar si la pantalla gestionada abre directo en «crear cuenta» con el correo; si no, la persona pulsa «Crear cuenta» y escribe el mismo correo. CA-14 no depende de eso.
- **El orden del despliegue:** backend (tabla, funciones, pre-registro), después `AiosAdministrator`, después el panel, y al final una versión nueva de ENSŌ. ENSŌ llega a Windows por la Microsoft Store, que revisa cada versión antes de publicarla. Hasta entonces, un código solo sirve a quien tenga la versión nueva.
- **El riesgo del correo no desaparece, se acota.** Un código sin tope que se filtra puede hacer salir hasta el freno diario de correos por día, hasta su vencimiento. Si eso preocupa, el freno se puede bajar al crear el código.
- **Dos textos de ENSŌ que hoy dicen algo falso**, vistos al analizar esto: `web/compra/gracias.js:186-187` («Pégala en ENSŌ, en Ajustes → Mi plan»: ese campo no existe) y `cuenta.sin_asiento` en `locales/es.json:4160` (da por hecho que alguien sin asiento puede crear su cuenta). No son de esta spec, pero `/codigo` vive al lado.
