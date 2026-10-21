# Spec: M1 · Cimientos del superadmin (login con MFA y API de admin)

- **Fecha:** 2026-10-21
- **Origen:** idea interna. El plan (`2026-10-20-plan-superadmin-aws.md`, versión 3, fase M1 en su §13) y su auditoría (`2026-10-21-auditoria-plan-superadmin.md`) viven en `docs/` de la raíz del workspace, fuera de este repo, porque nombran clientes reales.
- **Estado:** backend implementado en `aios-backend` (`feat/backend-superadmin-m1`, 2026-10-21); panel e infraestructura del panel, pendientes
- **Dónde se implementa:** la parte del panel y su infraestructura, en este repo. La del backend, en `aios-backend`, rama `feat/backend-superadmin-m1` (worktree `aios-backend-superadmin`, en la raíz del workspace).
- **Proyectos:** `aios-backend` (los CA marcados **[backend]**), `aios-admin` (**[panel]**) y la infraestructura de `aios-admin` (**[infra]**).

## Objetivo

Que las personas del equipo ensō (3 hoy, hasta 5) entren con MFA a un panel nuevo en AWS, y que la API de admin del backend diga quién es cada una y qué módulos puede usar. Es la base segura sobre la que M2 monta los módulos de clientes. M1 no reemplaza todavía ninguna pantalla del panel viejo.

## Alcance

**[backend] `aios-backend`**
- Pool de Cognito del equipo, aparte del de clientes. Va en un archivo de infraestructura propio, lo usa `aios-stack.js` y tiene la configuración de plan §3.1.
- Cliente confidencial del panel. Sus direcciones de retorno llegan por `AIOS_ADMIN_URLS`.
- Parámetros de SSM con los ids del pool, el id del cliente y la URL de la API de admin.
- Segundo HttpApi para `/v1/admin/*`, con autorizador JWT del pool del equipo que exige el scope `admin/acceso`.
- La **puerta del equipo** (`exigirPermiso`): verifica el access token en el código, carga los permisos y devuelve el actor `equipo:<sub>`.
- La comprobación de MFA reciente (`exigirMfaReciente`): exige el nivel `urn:cognito:loa:4` y un `auth_time` de menos de 900 s.
- La tabla de permisos del equipo, con clave `sub`.
- `GET /v1/admin/yo`.
- `PUT /v1/admin/equipo/{sub}/permisos`: solo para el superadministrador, con MFA reciente y motivo.
- El comando que da de alta a una persona del equipo, para crear al primer superadministrador.
- A0 mínimo:
  - la tabla `eventos`;
  - `src/lib/eventos.js`, `src/lib/actores.js`, sus pruebas y `tests/helpers/actores.js`, traídos del stash sin aplicarlo;
  - el canal `panel`;
  - `AIOS_ACTOR` ignorado en producción;
  - eventos para el alta de personas del equipo y los cambios de permisos.
- El candado contra mezclar pools, y el ajuste de `tests/infra-stack.test.js`.

**[panel] `aios-admin`**
- La app de React Router 8.5 en modo framework, con Node 24, TypeScript estricto, código en inglés y la estructura de plan §8.1.
- El login con el login administrado de Cognito: código + PKCE + `state` + `nonce`.
- La sesión del lado del servidor, con las reglas de plan §3.3, el cierre de sesión y la renovación de tokens en el servidor.
- El middleware que resuelve la sesión y `/yo` una vez por pedido y **niega por defecto**.
- La protección CSRF con `PUBLIC_ORIGINS`.
- Las cabeceras de seguridad.
- El cliente de la API, que traduce los nombres del backend.
- La redirección para volver a pedir el MFA.
- La página de inicio, con la identidad y los permisos de la persona.
- La identidad falsa para desarrollo local.

**[infra] `aios-admin/infra`**
- La prueba técnica de un día (Web Function o Lambda clásica).
- El stack mínimo del panel: servidor, bucket de código, bucket de estáticos, CloudFront con pago por uso, tabla de sesiones, llave KMS de sesiones, secreto de la cookie, logs y alarmas.
- Las barandas: `exigirCuentaPermitida`, `terminationProtection` y una política del stack.
- La prueba rápida (smoke) después de cada despliegue.

## Fuera de alcance

- **Los módulos:** Empresas, Usuarios de clientes, Ver como, Gobernanza y la pantalla de Equipo ensō son M2. Entrevistas, Documentos, Skills, Consumo y Upsell son M3. Los tableros son M5.
- **La ruta del webhook de Mappi,** la tabla y el S3 de onboarding, SQS, el worker y el Scheduler (M3).
- **`POST /v1/admin/eventos`** (M3), y `actividad` en el manifest (M5).
- **Partir los handlers `/v1/team/*` en puerta + núcleo** (M2).
- **El cliente público para `cargar.mjs`** (PKCE con retorno a `localhost`) y las rutas `/api/cli/*` (M3).
- **El dominio `admin.beenso.com`,** el certificado, el WAF y el plan Free de CloudFront (M4).
- **El CI/CD con OIDC:** llega cuando se arregle la facturación de GitHub Actions. Mientras tanto, despliega Jose a mano.
- **La revisión defensiva de la API,** antes de operar clientes reales en M2, y el trail de CloudTrail, antes de M3.
- **La concurrencia reservada del backend.**
- **Los 7 archivos restantes del stash** (`actividad.js`, `ficha-de-cliente.js`, `armar-mer.mjs` y sus pruebas): entran en la fase que los usa.

## Vocabulario de la API

- **Módulos** (identificadores del backend, en español): `vista-general`, `empresas`, `entrevistas`, `documentos`, `documentos-texto`, `skills`, `usuarios`, `consumo`, `gobernanza`, `upsell`. «Equipo ensō» no se asigna: es solo del superadministrador.
- **Niveles:** `ver` y `editar`; `editar` incluye `ver`. `vista-general`, `gobernanza` y `documentos-texto` solo admiten `ver`. Sin fila para un módulo = sin acceso.
- **«Leer texto» va aparte** (decisión 10): es el módulo `documentos-texto` con `ver`. Editar Documentos no lo da, y tenerlo no da editar.
- **En el panel** se traducen a inglés en `app/shared/api/` (`companies`, `documentText`, `view`, `edit`…).

## Criterios de aceptación

### Pool del equipo e infraestructura del backend

#### CA-1: El pool del equipo está aparte y protegido [backend]
- **Dado** el stack de `aios-backend` sintetizado
- **Cuando** se inspecciona la plantilla
- **Entonces** existe un segundo `AWS::Cognito::UserPool`:
  - con autoregistro apagado;
  - con MFA obligatorio y solo TOTP;
  - sin proveedores de identidad externos;
  - con dispositivos recordados apagados;
  - con plan `ESSENTIALS`;
  - con `DeletionPolicy: Retain`.
- **Y** su id lógico está en `infra/stack-policy.json`, con `Deny` de `Update:Replace` y `Update:Delete`.

#### CA-2: Cliente del panel con direcciones por variable [backend]
- **Dado** `AIOS_ADMIN_URLS=https://dxxxx.cloudfront.net`
- **Cuando** se sintetiza el stack
- **Entonces** el cliente del pool del equipo:
  - tiene secreto y usa el flujo de código;
  - tiene los scopes `openid` y `admin/acceso`;
  - tiene la dirección de retorno `https://dxxxx.cloudfront.net/auth/callback` y la de cierre `https://dxxxx.cloudfront.net/`;
  - no tiene ninguna dirección con `localhost`.
- **Y** sin `AIOS_ADMIN_URLS`, el stack crea el pool, el servidor de recursos y el parámetro con el id del pool, pero no el cliente del panel, ni el dominio del login, ni la API de admin, y el synth lo avisa. Esa es la primera de las dos pasadas del primer despliegue.

#### CA-3: Los stacks se conectan por SSM, no por exports [backend]
- **Dado** el stack sintetizado
- **Cuando** se inspecciona la plantilla
- **Entonces** hay parámetros de SSM: `/aios/equipo/pool-id` en las dos pasadas, y además `/aios/equipo/cliente-id`, `/aios/equipo/login-url` y `/aios/admin/api-url` en la segunda.
- **Y** ninguna salida del stack tiene `Export`.

#### CA-4: La API de admin es aparte y exige el scope [backend]
- **Dado** el stack sintetizado
- **Cuando** se inspeccionan los `AWS::ApiGatewayV2::Api`
- **Entonces** existe un segundo HttpApi con todas las rutas `/v1/admin/*`, sin configuración de CORS y con su propio freno.
- **Y** cada ruta usa un autorizador JWT con el issuer del pool del equipo, la audiencia del cliente del panel y el scope `admin/acceso`.
- **Y** la API pública no tiene ninguna ruta que empiece por `v1/admin`.

#### CA-5: Candado contra mezclar pools [backend]
- **Dado** el stack sintetizado y `RUTAS` de `src/lambda.js`
- **Cuando** corre la prueba de infraestructura
- **Entonces** ninguna función de `/v1/admin/*` recibe `COGNITO_ISSUER` ni `COGNITO_CLIENTE_ID` (los del pool de clientes).
- **Y** ninguna función de la API pública recibe `EQUIPO_ISSUER` ni `EQUIPO_CLIENTE_ID`.
- **Y** la prueba falla si empareja menos funciones de las que existen en cada API, para no quedar en verde sin revisar nada.
- **Y** el caso existente «toda función cuyo código autentica personas recibe el emisor y el cliente de Cognito» sigue en verde, porque no cuenta a las funciones de admin.

#### CA-6: La tabla de eventos es solo de agregar [backend]
- **Dado** el stack sintetizado
- **Cuando** se inspeccionan la tabla `eventos` y los roles de las funciones de admin
- **Entonces** la tabla tiene PITR, `DeletionProtectionEnabled` y `DeletionPolicy: Retain`, y está en `infra/stack-policy.json`.
- **Y** ningún rol tiene `dynamodb:UpdateItem` ni `dynamodb:DeleteItem` sobre ella.

### Puerta del equipo y API

#### CA-7: La puerta acepta solo access tokens del pool del equipo [backend]
- **Dado** el handler de `GET /v1/admin/yo`, corrido como función (sin API Gateway) y con las claves del verificador inyectadas
- **Cuando** llega:
  - (a) un access token válido del pool del equipo, con el scope;
  - (b) un ID token del mismo pool;
  - (c) un token del pool de clientes;
  - (d) un access token sin el scope;
  - (e) un token vencido;
  - (f) un token firmado con otra clave;
  - (g) ningún token
- **Entonces** responde 200 en (a) y 401 en todos los demás. La puerta no distingue «sin scope» de «inválido»: en los dos casos el token no sirve para la API de admin.
- **Y** el verificador de los ID tokens (`crearVerificador` con su comportamiento de hoy) sigue pasando `tests/verificador-de-token.test.js` sin cambios.

#### CA-8: `/yo` dice quién es y qué puede usar [backend]
- **Dado** una persona activa en la tabla de permisos, con `{ empresas: 'ver', 'documentos-texto': 'ver' }` y sin la marca de superadministrador
- **Cuando** pide `GET /v1/admin/yo` con su token
- **Entonces** recibe 200 con `cache-control: no-store` y `{ actor: 'equipo:<sub>', correo, nombre, superadmin: false, estado: 'activa', permisos: { empresas: 'ver', 'documentos-texto': 'ver' } }`.
- **Y** la respuesta no trae ningún token ni secreto.

#### CA-9: Matriz de niveles [backend]
- **Dado** `exigirPermiso(pedido, módulo, nivel)`
- **Cuando** se prueba cada combinación de nivel concedido (ausente, `ver`, `editar`, superadministrador) contra cada nivel pedido
- **Entonces**:
  - `ver` lo cumplen `ver` y `editar`;
  - `editar` lo cumple solo `editar`;
  - `documentos: 'editar'` no da `documentos-texto`, y `documentos-texto` no da `editar` en Documentos;
  - el superadministrador cumple todo;
  - sin nivel, o con un módulo o un nivel que no existen (también para el superadministrador), se niega con 403.
- **Y** la tabla completa de combinaciones está escrita en la prueba.

#### CA-10: Cambiar permisos exige superadministrador, MFA reciente y motivo [backend]
- **Dado** un superadministrador con un token de `acr = urn:cognito:loa:4` y `auth_time` de hace 5 minutos
- **Cuando** pide `PUT /v1/admin/equipo/{sub}/permisos` con permisos válidos y `motivo`
- **Entonces** responde 200 con los permisos nuevos.
- **Y** la fila de permisos y un evento (`actor: equipo:<sub>`, canal `api`, motivo) se escriben en la misma transacción (`escribirConEvento`).
- **Y** con `auth_time` de hace 16 minutos, o sin `acr` de nivel 4, responde 401 con `codigo: 'mfa-reciente'` y no escribe nada.
- **Y** quien no es superadministrador recibe 403, aunque su MFA sea reciente.
- **Y** sin `motivo` responde 422.

#### CA-11: Reglas del equipo [backend]
- **Dado** el endpoint de CA-10
- **Cuando**:
  - (a) un superadministrador intenta editar sus propios permisos;
  - (b) se quita la marca de superadministrador al único que queda;
  - (c) se manda un módulo o un nivel que no existen
- **Entonces** responde 409 en (a) y 422 en (c), y no escribe ni fila ni evento.
- **Y** (b) no puede pasar por esta ruta: quien pide ya es superadministrador y no puede cambiarse a sí mismo, así que siempre queda él. Lo cubre (a).

#### CA-12: Alta del primer superadministrador por comando [backend]
- **Dado** el comando de alta del equipo
- **Cuando** se corre con un correo, `--superadmin` y `--motivo`, sin `--si`
- **Entonces** muestra la vista previa (qué persona y qué permisos) y no cambia nada.
- **Y** con `--si`:
  - crea la persona en el pool del equipo (Cognito le manda su contraseña temporal);
  - escribe su fila de permisos con clave `sub` y la marca de superadministrador;
  - escribe un evento con canal `comando`, en la misma escritura que la fila. El actor es la identidad de AWS (STS) contra producción, y `local:<usuario>` en local.
- **Y** si se repite con el mismo correo, no duplica a la persona: dice que ya existe.

#### CA-13: A0 mínimo, traído sin aplicar el stash [backend]
- **Dado** el árbol de la rama del backend
- **Cuando** se revisa
- **Entonces** están `src/lib/eventos.js`, `src/lib/actores.js`, `tests/eventos.test.js`, `tests/actores.test.js` y `tests/helpers/actores.js`, y `git stash list` sigue mostrando el stash «feat/admin-api WIP 2026-10-08».
- **Y** `CANALES` incluye `panel`.
- **Y** con `AIOS_ENTORNO=produccion`, `actorDelComando` ignora `AIOS_ACTOR` y toma el actor de STS.
- **Y** `TABLES` incluye `eventos` y la tabla de permisos del equipo.

#### CA-14: Las pruebas nuevas corren de verdad [backend]
- **Dado** `package.json` de `aios-backend`
- **Cuando** se revisa la lista de `npm test`
- **Entonces** cada archivo `tests/*.test.js` nuevo de M1 aparece en ella. Las listas están escritas a mano: un test que no está ahí no corre.
- **Y** `npm test` termina en verde, con los fallos de antes de M1 en el mismo estado (se compara la lista de nombres fallidos, no el conteo).

#### CA-15: El backend local monta la API de admin [backend]
- **Dado** `npm run dev` (`scripts/dev-local.mjs`)
- **Cuando** se pide `GET /v1/admin/yo` sin token
- **Entonces** responde 401, porque la puerta verifica en el código aunque en local no haya autorizador.
- **Y** con un token de la identidad falsa (CA-29), cuyas claves se le inyectan al verificador, responde 200.

### Panel: login y sesión

#### CA-16: La app arranca con la base acordada [panel]
- **Dado** el repo `aios-admin`
- **Cuando** se corre `npm run build`
- **Entonces**:
  - termina sin errores con Node 24 (`.nvmrc` = `24`) y TypeScript estricto;
  - `package.json` fija exactamente la versión 8.5.0 de `react-router`, `@react-router/dev`, `@react-router/node` y `@react-router/express`;
  - no incluye `@react-router/fs-routes` ni `@react-router/architect`.

#### CA-17: Estructura y reglas del front [panel]
- **Dado** el repo
- **Cuando** corre la prueba de estructura
- **Entonces** falla si:
  - un archivo de `app/` no está en kebab-case;
  - un módulo de `app/modules/` importa de otro módulo;
  - `app/shared/` o `app/domain/` importan de `app/modules/`;
  - `app/domain/` importa React.
- **Y** cada falla nombra el archivo y la importación.

#### CA-18: Entrar redirige a Cognito con PKCE, `state` y `nonce` [panel]
- **Dado** un pedido sin sesión a cualquier página, con `Host` igual al dominio del endpoint de Lambda
- **Cuando** el servidor responde
- **Entonces** es un 302 al endpoint `authorize` del pool del equipo, con:
  - `response_type=code`;
  - `code_challenge_method=S256`;
  - `state` y `nonce` al azar;
  - el scope `admin/acceso`;
  - `redirect_uri` igual a `PUBLIC_ORIGINS[0] + '/auth/callback'`. Nunca sale del `Host`.

#### CA-19: El retorno crea una sesión que el navegador no puede leer [panel]
- **Dado** un retorno a `/auth/callback` con un `code` válido y el `state` y el `nonce` correctos
- **Cuando** el servidor lo procesa
- **Entonces**:
  - guarda una fila de sesión cuya clave es el *hash* SHA-256 del id, con los tokens cifrados con la llave KMS de sesiones;
  - responde con una cookie `__Host-` que es `HttpOnly`, `Secure` y `SameSite=Lax`, con `Path=/` y sin `Domain`;
  - redirige a la página de inicio.
- **Y** ninguna respuesta del panel (cuerpo, cabeceras o HTML) contiene un JWT: la prueba busca el patrón `eyJ…\.…\.…`.
- **Y** si había una cookie de sesión anterior, el id nuevo es distinto: el id se rota al iniciar sesión.

#### CA-20: Tiempos de la sesión [panel]
- **Dado** un reloj inyectado y una sesión válida
- **Cuando**:
  - (a) pasan 12 h desde el login;
  - (b) pasan 60 min sin pedidos;
  - (c) pasan 60 min con solo pedidos de refresco automático (`useRevalidator`, marcados como tales);
  - (d) pasan 59 min y llega un pedido normal
- **Entonces**:
  - en (a), (b) y (c), el siguiente pedido normal manda a login y borra la fila;
  - en (d), la sesión sigue y su inactividad vuelve a cero.
- **Y** la vigencia se decide con las fechas de la fila, no con el borrado por TTL de DynamoDB.

#### CA-21: La renovación de tokens pasa en el servidor [panel]
- **Dado** una sesión válida con el access token vencido
- **Cuando** llega un pedido
- **Entonces** el servidor renueva con el refresh token, actualiza la fila y responde normal, sin que el navegador vea ningún token.

#### CA-22: Cerrar sesión cierra todo [panel]
- **Dado** una sesión válida
- **Cuando** se envía `POST /auth/logout` desde el panel
- **Entonces**:
  - el servidor revoca el refresh token en `/oauth2/revoke`;
  - borra la fila;
  - vence la cookie;
  - redirige a `/logout` de Cognito con `client_id` y `logout_uri`.
- **Y** si después se pide cualquier página, hay que volver a pasar por Cognito con MFA.

#### CA-23: Volver a pedir el MFA [panel]
- **Dado** una *action* que llama al backend y recibe 401 con `codigo: 'mfa-reciente'`
- **Cuando** el servidor del panel responde
- **Entonces** es un 302 a `authorize` con `acr_values=urn:cognito:loa:4` y `max_age=900`, y con `state` que guarda la página de origen.
- **Y** al volver, la persona queda en esa página (la acción no se repite sola).

### Panel: permisos y protección

#### CA-24: `/yo` una sola vez por pedido [panel]
- **Dado** un cliente de API falso que cuenta las llamadas
- **Cuando** llega un pedido a una ruta con *loaders* anidados (raíz + página)
- **Entonces** `/v1/admin/yo` se llama como mucho una vez, y su caché tiene clave `sub` y una vida máxima de 30 s.

#### CA-25: Se niega por defecto [panel]
- **Dado** el mapa de rutas (`app/routes.ts`)
- **Cuando** corre la prueba de declaración de permisos
- **Entonces** falla, nombrando la ruta, si alguna no declara su módulo y su nivel. Solo están exentas `/auth/*`, `/dev/*` (en desarrollo) y la página de «sin acceso».
- **Y** en tiempo de ejecución, una ruta sin declaración responde 403.
- **Y** una persona sin el nivel que pide una ruta recibe la página de «sin acceso», y el menú no muestra los módulos que no puede usar.

#### CA-26: Dos personas a la vez no se mezclan [panel]
- **Dado** dos personas con permisos distintos
- **Cuando** se mandan 50 pedidos intercalados de las dos al mismo proceso del servidor
- **Entonces** cada respuesta tiene la identidad y los permisos de quien la pidió.
- **Y** ningún estado de un pedido vive a nivel de módulo de JavaScript.

#### CA-27: CSRF con la lista fija de orígenes [panel]
- **Dado** `PUBLIC_ORIGINS=https://dxxxx.cloudfront.net` y un `Host` igual al dominio del endpoint de Lambda
- **Cuando** llega un POST:
  - (a) con `Origin: https://dxxxx.cloudfront.net`;
  - (b) con `Origin: https://evil.example`;
  - (c) sin `Origin` y con `Sec-Fetch-Site: same-origin`;
  - (d) sin `Origin` y sin `Sec-Fetch-Site`
- **Entonces** se acepta en (a) y (c), y responde 403 en (b) y (d).

#### CA-28: Cabeceras de seguridad [panel]
- **Dado** cualquier respuesta HTML del panel
- **Cuando** se inspeccionan sus cabeceras
- **Entonces** trae:
  - `Content-Security-Policy`, con scripts solo propios o con *nonce* y `frame-ancestors 'none'`;
  - `Strict-Transport-Security`;
  - `Referrer-Policy`.

#### CA-29: Identidad falsa solo en desarrollo [panel]
- **Dado** `npm run dev`
- **Cuando** se abre `/dev/login`
- **Entonces** se puede elegir «entrar como» cualquier combinación de permisos y queda una sesión. Los tokens que firma el servicio local pasan por la puerta del backend local (CA-15).
- **Y** `npm run build` produce una salida sin el código de `dev/`: la prueba busca su marcador en la salida.
- **Y** el build falla si algún archivo de `app/` importa de `dev/`.

#### CA-30: El cliente de la API traduce en un solo lugar [panel]
- **Dado** la respuesta del backend `{ actor, correo, nombre, superadmin, estado, permisos: { empresas: 'ver', 'documentos-texto': 'ver' } }`
- **Cuando** pasa por `app/shared/api/`
- **Entonces** el panel recibe `{ actor, email, name, isSuperadmin, status, permissions: { companies: 'view', documentText: 'view' } }`.
- **Y** un módulo o un nivel desconocido se descarta y queda en el log, sin romper la página.

#### CA-31: Página de inicio [panel]
- **Dado** una persona con sesión
- **Cuando** abre `/`
- **Entonces** ve su nombre, si es superadministradora y la lista de sus módulos con su nivel, tal como los da `/yo`.

### Infraestructura del panel

#### CA-32: Prueba técnica de un día [infra]
- **Dado** la app vacía desplegada como Web Function detrás de CloudFront con OAC
- **Cuando** se corre la prueba
- **Entonces** quedan escritos en esta spec (sección «Resultado de la prueba técnica») tres resultados:
  - un POST real a través de CloudFront responde 2xx;
  - el tiempo de arranque en frío, medido;
  - durante un `cdk deploy` que reemplaza la revisión, todos los pedidos de un ciclo de 1 por segundo responden 2xx.
- **Y** si falla uno, la decisión dice «camino B» y el resto de los CA de infraestructura se cumple con la Lambda clásica + Web Adapter.

#### CA-33: Contenido del stack del panel [infra]
- **Dado** el stack de `aios-admin` sintetizado (camino A)
- **Cuando** se inspecciona la plantilla
- **Entonces** contiene:
  - la Web Function en Node 24 y Arm, con el endpoint en `maxEnvironments: 2` y `rateLimit: 100`;
  - un bucket de código versionado, con SSE-S3 y sin regla que expire versiones viejas;
  - un bucket de estáticos privado, con OAC;
  - CloudFront sin web ACL, con dos comportamientos: `/assets/*` con caché, y el resto con `AllViewerExceptHostHeader` + `CachingDisabled`;
  - la tabla de sesiones con TTL, `DeletionProtectionEnabled` y `DeletionPolicy: Retain`;
  - una llave KMS de sesiones que solo el rol del panel puede usar para descifrar;
  - un secreto con la llave de la cookie;
  - los grupos de logs `/aws/lambda/web/<fn>` y `<fn>.local`, con 30 días de retención;
  - alarmas de errores 5xx y de throttles del endpoint (`AWS/Lambda/Web`) que avisan al tema de alarmas del backend, pasado por ARN;
  - `terminationProtection` activado y una política del stack.

#### CA-34: Solo se despliega en la cuenta correcta [infra]
- **Dado** credenciales de una cuenta que no es `enso`
- **Cuando** se corre el synth o el despliegue
- **Entonces** falla antes de crear nada, con un mensaje que nombra la cuenta esperada y la recibida. Es la misma regla de `aios-backend/infra/cuentas.js`.

#### CA-35: El panel lee la configuración del backend sin copiarla [infra]
- **Dado** el stack sintetizado
- **Cuando** se inspeccionan el rol del panel y su configuración
- **Entonces**:
  - el panel lee de SSM el id del pool, el id del cliente y la URL de la API;
  - el rol solo tiene `cognito-idp:DescribeUserPoolClient`, limitado al ARN del pool del equipo, para leer el secreto del cliente;
  - ningún secreto de Cognito está en la plantilla ni en variables de entorno.

#### CA-36: Prueba rápida después de cada despliegue [infra]
- **Dado** una URL desplegada
- **Cuando** se corre `npm run smoke -- <url>`
- **Entonces** comprueba que:
  - `GET /` responde 302 a `authorize` del pool del equipo;
  - un archivo de `/assets/` responde 200;
  - `GET <api>/v1/admin/yo` sin token responde 401.
- **Y** termina con un código distinto de 0 si falla cualquiera.

### Producción

#### CA-37: Login real con MFA [infra, manual]
- **Dado** el primer superadministrador creado con el comando de CA-12
- **Cuando** abre la URL `…cloudfront.net`, cambia su contraseña temporal, configura TOTP y entra
- **Entonces** ve la página de inicio con sus permisos.
- **Y** una persona del pool sin fila de permisos ve «sin acceso».

#### CA-38: Cognito vuelve a pedir el MFA [infra, manual]
- **Dado** una sesión con un `auth_time` de hace más de 15 minutos
- **Cuando** el panel redirige con `acr_values=urn:cognito:loa:4&max_age=900`
- **Entonces** Cognito vuelve a pedir el código TOTP.
- **Y** el token nuevo trae `acr = urn:cognito:loa:4` y un `auth_time` actualizado.
- **Y** si Cognito no lo soporta en el plan del pool, queda escrito en esta spec y se aplica la alternativa de «Riesgos».

## Casos borde y de error

### CB-1: Rotación de claves del proveedor
- **Dado** un token con un `kid` que el verificador no tiene en caché
- **Cuando** llega a la puerta del equipo
- **Entonces** recarga las claves como mucho una vez por intervalo (el comportamiento de hoy de `crearVerificador`) y acepta el token si la firma cuadra.

### CB-2: Cognito no responde en el retorno
- **Dado** que el intercambio del `code` falla o se agota
- **Cuando** se procesa `/auth/callback`
- **Entonces** el panel muestra una página de error sin detalles técnicos, no crea sesión y no registra el `code`.

### CB-3: La sesión se cerró en otra pestaña
- **Dado** dos pestañas con la misma sesión
- **Cuando** una cierra sesión y la otra hace un pedido
- **Entonces** la otra va a login: la fila ya no existe.

### CB-4: Cookie alterada o desconocida
- **Dado** una cookie con un id que no corresponde a ninguna fila
- **Cuando** llega un pedido
- **Entonces** se trata como «sin sesión» (302 a login), sin error 500.

### CB-5: Persona suspendida con la sesión abierta
- **Dado** una persona que el superadministrador suspende mientras tiene sesión
- **Cuando** hace su siguiente pedido, después de que vence la caché de `/yo` (≤ 30 s)
- **Entonces** el backend responde 403, el panel muestra «sin acceso» y borra la sesión.

### CB-6: Permisos que cambian con la sesión abierta
- **Dado** una persona a la que se le quita `empresas`
- **Cuando** pasan como mucho 30 s
- **Entonces** el menú ya no muestra Empresas, y las rutas de Empresas responden «sin acceso».

### CB-7: Cuerpo inválido o enorme
- **Dado** un `PUT /v1/admin/equipo/{sub}/permisos` con JSON roto o un cuerpo de más de 16 KB
- **Cuando** llega
- **Entonces** responde 422 o 413 y no escribe ni fila ni evento.

### CB-8: Persona que no existe
- **Dado** un `{sub}` que no está en la tabla de permisos
- **Cuando** se pide cambiar sus permisos
- **Entonces** responde 404 y no escribe ningún evento.

### CB-9: Falla la escritura del evento
- **Dado** que la transacción de fila + evento falla
- **Cuando** se cambian permisos
- **Entonces** responde 500 con un mensaje accionable y los permisos quedan como estaban: nada a medias.

### CB-10: El mismo correo en los dos pools
- **Dado** una persona que es admin de un cliente en el pool de clientes y también está en el pool del equipo (por ejemplo, alguien del equipo que también es admin de la empresa ENSŌ)
- **Cuando** usa su token del pool de clientes contra `/v1/admin/yo`
- **Entonces** recibe 401.
- **Y** con el token del pool del equipo recibe 200 con actor `equipo:<sub>`, que no coincide con su correo de cliente.

### CB-11: `PUBLIC_ORIGINS` vacío o mal escrito
- **Dado** el servidor del panel con `PUBLIC_ORIGINS` vacío o con una URL sin `https://`
- **Cuando** arranca
- **Entonces** no empieza a escuchar y deja en el log qué variable falta. Nunca acepta todos los orígenes.

### CB-12: El servidor tarda en arrancar
- **Dado** que leer el secreto o SSM tarda
- **Cuando** arranca la Web Function
- **Entonces** el servidor empieza a escuchar antes de esas lecturas (que van después de `listen`), dentro de los 10 s que da Lambda, y los pedidos que llegan antes de tener la configuración responden 503.

### CB-14: Fila de sesión vencida que DynamoDB todavía no borró
- **Dado** una fila con el TTL vencido pero aún presente
- **Cuando** llega un pedido con su cookie
- **Entonces** se trata como vencida (CA-20).

## Plan de pruebas

| Criterio | Tipo de test | Dónde |
|---|---|---|
| CA-1, CA-2, CA-3, CA-4, CA-5, CA-6 | unit (plantilla sintetizada, una vez por pasada) | `aios-backend/tests/infra-equipo.test.js` + ajustes en `tests/infra-stack.test.js` |
| CA-7, CB-1, CB-10 | unit, con claves inyectadas | `aios-backend/tests/puerta-del-equipo.test.js` (nuevo) |
| CA-8 | unit (handler como función) | `aios-backend/tests/admin-yo-endpoint.test.js` (nuevo) |
| CA-9 | unit (matriz) | `aios-backend/tests/permisos-del-equipo.test.js` (nuevo) |
| CA-10, CA-11, CB-7, CB-8, CB-9 | integration (motor de tablas en memoria) | `aios-backend/tests/admin-equipo-permisos-endpoint.test.js` (nuevo) |
| CA-12 | integration (Cognito y tablas dobles) + el comando real sin `--si` | `aios-backend/tests/equipo-alta.test.js` |
| CA-13 | unit + inspección | `tests/eventos.test.js`, `tests/actores.test.js` (del stash) + un caso nuevo para `AIOS_ENTORNO=produccion` |
| CA-14 | inspección + suite | `npm test` de `aios-backend`, comparando nombres fallidos antes y después |
| CA-15 | integration (servidor local) | `aios-backend/tests/dev-local-admin.test.js` (nuevo) |
| CA-16, CA-17 | unit (build + grafo de imports) | `aios-admin/tests/structure.test.ts` |
| CA-18, CA-19, CA-21, CB-2, CB-4, CB-14 | integration (Cognito falso) | `aios-admin/tests/auth-flow.test.ts` |
| CA-20 | unit (reloj inyectado) | `aios-admin/tests/session-timeouts.test.ts` |
| CA-22, CB-3 | integration | `aios-admin/tests/logout.test.ts` |
| CA-23 | unit (*action* como función) | `aios-admin/tests/fresh-mfa.test.ts` |
| CA-24, CA-25, CB-5, CB-6 | unit + integration (API falsa que cuenta) | `aios-admin/tests/permissions-middleware.test.ts`, `aios-admin/tests/routes-declare-permission.test.ts` |
| CA-26 | integration (concurrencia) | `aios-admin/tests/concurrent-requests.test.ts` |
| CA-27, CB-11 | unit | `aios-admin/tests/csrf.test.ts` |
| CA-28 | unit (cabeceras) | `aios-admin/tests/security-headers.test.ts` |
| CA-29 | unit (build) | `aios-admin/tests/dev-identity-excluded.test.ts` |
| CA-30 | unit | `aios-admin/tests/api-client-mapping.test.ts` |
| CA-31 | unit (*loader* + componente) | `aios-admin/tests/home.test.ts` |
| CA-32, CA-37, CA-38 | manual (en AWS, lo despliega Jose) | resultado escrito en esta spec |
| CA-33, CA-35, CB-12 | unit (plantilla sintetizada) | `aios-admin/infra/tests/stack.test.ts` |
| CA-34 | unit | `aios-admin/infra/tests/account-guard.test.ts` |
| CA-36 | manual + script | `aios-admin/scripts/smoke.mjs`, después de cada despliegue |

Presupuesto de las pruebas: ≤ 100 ms cada una y 1 s de techo, según el `CLAUDE.md` global. Las de concurrencia (CA-26) y las del build (CA-16, CA-29) llevan escrito al lado qué esperan, si pasan el techo.

## Archivos probablemente afectados

**`aios-backend`**
- `infra/equipo.js` (nuevo): el pool del equipo, el servidor de recursos, el cliente, los parámetros de SSM y el segundo HttpApi. Es un archivo aparte porque `aios-stack.js` ya pasa de 1 000 líneas.
- `infra/aios-stack.js`: usa `infra/equipo.js` y monta las rutas de admin.
- `infra/app.js`: lee `AIOS_ADMIN_URLS`.
- `infra/stack-policy.json`: el pool del equipo y las tablas `eventos` y de permisos.
- `src/lambda.js`: las rutas `v1/admin/*`, en su propia lista.
- `src/handlers/admin-yo.js` y `src/handlers/admin-equipo-permisos.js` (nuevos).
- `src/lib/admin/puerta-del-equipo.js` (nuevo): `exigirPermiso` y `exigirMfaReciente`.
- `src/lib/admin/permisos-del-equipo.js` (nuevo): la tabla, las reglas y la matriz.
- `src/lib/verificador-de-token.js`: acepta el tipo de token. Por defecto sigue en `id`, sin cambiar a quienes ya lo usan; con `access` exige `client_id`, `token_use=access` y el scope, y no exige correo.
- `src/lib/storage.js`: `TABLES.eventos` y la tabla de permisos.
- `src/lib/eventos.js` y `src/lib/actores.js` (del stash): el canal `panel` y `AIOS_ACTOR` en producción.
- `scripts/equipo.mjs` (nuevo) + su entrada en `package.json`: el alta por comando.
- `scripts/dev-local.mjs`: monta las rutas de admin y acepta las claves de la identidad falsa.
- `tests/…` (los nuevos del plan de pruebas) y `tests/infra-stack.test.js` (ajuste).
- `package.json`: los tests nuevos en la lista de `npm test`.

**`aios-admin`** (repo nuevo)
- `.nvmrc`, `package.json`, `tsconfig.json`, `react-router.config.ts`.
- `app/root.tsx`, `app/routes.ts`.
- `app/middleware/`: sesión, `/yo`, permisos, CSRF y cabeceras.
- `app/shared/auth/`: login, retorno, cierre y MFA reciente.
- `app/shared/api/`: el cliente de `/v1/admin/*` y la traducción.
- `app/shared/ui/`.
- `app/modules/home/`: la página de inicio.
- `app/domain/` (vacío en M1, con su regla en la prueba de estructura).
- `server/`: el servidor Express de React Router, que escucha en `AWS_LAMBDA_HTTP_ENDPOINT || PORT`.
- `dev/`: la identidad falsa.
- `infra/`: el stack, la guarda de cuenta y sus pruebas.
- `scripts/smoke.mjs`.
- `tests/`.

## Resultado de la prueba técnica

*(Se completa al correr CA-32 y CA-38.)*

- Camino elegido: —
- POST por CloudFront: —
- Arranque en frío: —
- Despliegue sin corte: —
- MFA reciente con `acr_values`: —

## Riesgos y preguntas abiertas

- **Rama de `aios-backend`:** la define Jose (checklist §14, paso 3). Sin ella no se empieza la parte del backend.
- **El repo `aios-admin`:** lo crea Jose (paso 1). Esta spec se mueve ahí cuando exista.
- **`acr_values` en Cognito:** si la prueba de CA-38 muestra que no se respeta con el plan Essentials, la alternativa es `prompt=login` (obliga a iniciar sesión de nuevo, con MFA) y el backend sigue validando `auth_time` ≤ 900 s. Hay que decidirlo con el resultado.
- **`DescribeUserPoolClient`:** si resulta incómodo leer el secreto del cliente así, se copia una vez a Secrets Manager. Cambia CA-35.
- **El nombre del comando de alta** (`npm run equipo`) y los de las rutas de admin son una propuesta. Se fijan al implementar, sin cambiar el comportamiento de los CA.
- **Versión de CDK en `aios-admin`:** las Web Functions necesitan `aws-cdk-lib` ≥ 2.273.0, con constructos de bajo nivel. El backend sigue en la suya.
- **Node 24 en la máquina de desarrollo** (hoy tiene 22.19): lo instala Jose (paso 6).
- **El primer despliegue va en dos pasadas:** backend sin `AIOS_ADMIN_URLS` → panel → backend con la URL de CloudFront (CA-2). Lo corre Jose; Claude prepara los comandos y avisa antes de cada acción en AWS.
