# Spec: Paginación numerada en las listas del panel

- **Fecha:** 2026-11-03
- **Origen:** pedido de Jose. La paginación de hoy solo tiene «Primera página» y «Siguiente»: no dice en qué página estás, cuántas hay ni deja saltar a otra.
- **Estado:** borrador
- **Repos:** `aios-backend` (worktree `aios-backend-superadmin`) y `aios-admin`, los dos en la rama `superadmin_v2`.

## Objetivo

Las cuatro listas del panel (Empresas, Cuentas personales, Usuarios de clientes y Gobernanza) muestran en qué página estás, cuántas hay y dejan ir a cualquiera: «Mostrando 51–100 de 377 cuentas personales», «Anterior», `1 … 4 5 [6] 7 8 … 20`, «Siguiente».

## Por qué esta forma

Las formas más usadas, y por qué se elige la numerada con «…»:

| Forma | Dónde se ve | Para estas listas |
|---|---|---|
| Anterior / Siguiente (la de hoy) | feeds, APIs con cursor | No dice dónde estás ni deja saltar. |
| **Numerada con «…»** | GitHub, Google, las librerías de tablas (MUI, Ant Design) y el panel viejo de beenso | **La elegida.** Dice dónde estás, deja saltar y ocupa siempre el mismo ancho. |
| «Cargar más» o desplazamiento infinito | redes sociales | Pierde el lugar al recargar y una página no se puede compartir. |
| Numerada con caja para escribir el número y selector de tamaño | tablas con miles de páginas | De más: la lista más larga tiene unas 8 páginas. |

El backend ya trae cada lista entera a memoria antes de cortar la página (`listar` de la partición completa). Por eso pasar del cursor al número de página no cuesta lecturas de más, y el total sale gratis. Lo que se acepta: si alguien entra o sale de la lista entre dos páginas, un elemento puede repetirse o saltarse. Ya pasa hoy con el cursor por posición de las personas, y en una lista de soporte vale más poder saltar.

## Alcance

- **Backend:** `GET /v1/admin/clientes`, `GET /v1/admin/personas` y `GET /v1/admin/auditoria` paginan por número y dicen cuántas páginas hay. El cursor desaparece de las tres.
- **Panel:** el componente de paginación compartido (`app/shared/ui/pager.tsx`) y las tres pantallas que lo usan.

## Fuera de alcance

- **Elegir cuántas filas por página.** Siguen siendo 50, las de siempre del backend.
- **Escribir el número de página para saltar.**
- **Paginar la búsqueda.** Sigue mostrando hasta 100 coincidencias, con el aviso de que hay más.
- **La historia de una empresa** (`/historia`): no tiene páginas, trae las últimas.

## Criterios de aceptación

### Backend

### CA-1: Las listas paginan por número

- **Dado** un pedido a `GET /v1/admin/clientes`, `/v1/admin/personas` o `/v1/admin/auditoria` con `?pagina=N`,
- **cuando** responde,
- **entonces** trae los elementos de esa página, con los mismos filtros y el mismo orden de hoy, y además `paginacion: { pagina, paginas, total, porPagina }`. `total` cuenta la lista entera con sus filtros, no la página. Sin `?pagina=`, responde la primera.

### CA-2: Una página después de la última da la última

- **Dado** `?pagina=` mayor que la cantidad de páginas (un enlace viejo, y la lista se achicó),
- **cuando** responde,
- **entonces** trae la última página, y `paginacion.pagina` dice cuál es. Una lista vacía responde `{ pagina: 1, paginas: 1, total: 0 }`.

### CA-3: Un número que no sirve es un 422

- **Dado** `?pagina=` que no es un entero de 1 en adelante (`0`, `-1`, `2.5`, `abc`) o es absurdamente grande,
- **cuando** se pide,
- **entonces** responde 422 con un mensaje en español, sin tocar la tabla.

### CA-4: El cursor desaparece

- **Dado** cualquiera de las tres listas,
- **cuando** responde,
- **entonces** no trae `siguiente`, y un `?cursor=` que llegue se ignora (responde la primera página). El panel desplegado antes de esta spec pierde el «Siguiente» hasta que se despliega el nuevo; el único que usa el panel es Jose, y el panel va enseguida.

### Panel

### CA-5: La paginación dice dónde estás

- **Dado** una lista con elementos en Empresas (las dos pestañas), Usuarios de clientes o Gobernanza,
- **cuando** se ve,
- **entonces** abajo dice «Mostrando A–B de N <cosas>» (por ejemplo «Mostrando 51–100 de 377 cuentas personales») y, si hay más de una página, «Anterior», los números y «Siguiente».

### CA-6: Qué números se ven

- **Dado** P páginas y la actual A,
- **cuando** se arma la fila de números,
- **entonces**:
  - con P ≤ 7 se ven todas;
  - con P > 7 se ven siempre 7 lugares, así el ancho no salta: la primera, la última, la actual con una a cada lado y «…» en el hueco. Cerca del principio, `1 2 3 4 5 … P`; cerca del final, `1 … P-4 P-3 P-2 P-1 P`.

### CA-7: La actual se distingue y los extremos se desactivan

- **Dado** la fila de números,
- **cuando** se ve,
- **entonces** la página actual no es un enlace, va resaltada y lleva `aria-current="page"`. En la primera página «Anterior» se ve desactivado, y en la última, «Siguiente»: son enlaces sin destino con `aria-disabled="true"`, que el lector de pantalla anuncia como desactivados.

### CA-8: La página viaja en la dirección

- **Dado** una página que no es la primera,
- **cuando** se recarga o se comparte el enlace,
- **entonces** abre la misma página con los mismos filtros (`?page=N`; la primera no lo lleva). Cambiar de pestaña, de plan, de empresa o de objetivo vuelve a la primera. Un `?page=` que no es un número se lee como la primera.

### CA-9: Con una página o ninguna

- **Dado** una lista que cabe en una página,
- **cuando** se ve,
- **entonces** queda solo «Mostrando 1–N de N …», sin botones. Con cero elementos no se ve la paginación: el mensaje de la lista vacía ya lo dice.

## Casos borde

### CB-1: Contra el backend de antes

- **Dado** una respuesta sin `paginacion` (el backend todavía no se desplegó),
- **cuando** el panel la lee,
- **entonces** no se cae: muestra lo que llegó como una sola página.

### CB-2: Un enlace viejo con cursor

- **Dado** una dirección guardada con `?cursor=…`,
- **cuando** se abre,
- **entonces** muestra la primera página, sin error.

### CB-3: Usuarios de clientes con entradas sin asiento

Usuarios de clientes pagina el índice de correos, y descarta después del corte las entradas que no tienen asiento (las muertas, que muestra la revisión de datos). Filtrarlas antes costaría leer el asiento de cada persona de la lista en cada página. Por eso el total de esa lista cuenta también las muertas, y una página puede salir más corta o vacía.

- **Dado** una página de Usuarios de clientes que llega vacía aunque la lista tiene total,
- **cuando** se ve,
- **entonces** dice «En esta página no quedan personas vigentes: sus entradas no tienen asiento (las muestra la revisión de datos).», y no que la empresa no tiene a nadie.

## Despliegue

Primero el backend y después el panel, como siempre. En el rato entre los dos, el panel desplegado no muestra «Siguiente» (CA-4).
