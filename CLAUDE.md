# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

App para diseñar una novela **antes** de escribirla: trama, personajes y capítulos.
El diseño completo está en [ARCHITECTURE.md](ARCHITECTURE.md); este fichero recoge
lo que no se deduce leyendo el código.

**Idioma:** el proyecto está en español — comentarios, mensajes de error de la API,
UI y commits. Mantenerlo.

## Estado

`api/` y `react/` están implementados y verificados. `react-native/` se deja
**vacío a propósito**: no crear nada dentro.

Dentro de `react/`, las cuatro tabs de trabajo diario están implementadas:
Libro (resumen de sólo lectura), Trama, Personajes y Capítulos. La gestión de
libros (alta completa, edición y borrado) no es una tab — se abre con
"Gestionar libros" en la cabecera, junto al selector de libro (ver más abajo).

## Comandos

```bash
docker compose up -d postgres      # sólo la BD (:5432)
docker compose up -d               # BD + Adminer (:8081)

cd api
npm run dev                        # tsx watch, :3000
npm run typecheck                  # tsc --noEmit
npx prisma migrate dev             # tras tocar schema.prisma
npx prisma migrate status          # comprobar sincronía con la BD
npx prisma studio                  # inspeccionar datos

cd react
npm run dev                        # :5173, ya escucha en 0.0.0.0 (vite.config.ts)
npm run build                      # tsc -b && vite build
npm run typecheck
```

No hay suite de tests. La API se verifica con `curl` contra la BD real; el
frontend, conduciendo Chromium con Playwright.

Playwright **no** es dependencia del proyecto a propósito: se instala en un
directorio temporal y el script de verificación se ejecuta desde allí, para no
meter un navegador de 300 MB en `react/package.json`. Merece la pena verificar
cargando la app **por la IP de red** (no `localhost`), que es como entra el
iPad; es el único modo de detectar los fallos de `VITE_API_URL`.

## Arquitectura

Sólo Postgres va en Docker. API y frontend corren en local para conservar el
hot-reload.

```
react (Vite :5173) ──HTTP──► api (Express :3000) ──TCP──► postgres (docker :5432)
                                    │                          │
                                    ▼                          ▼
                            ./uploads/characters        ./postgres-data
```

`books` es la raíz; de ella cuelgan `characters`, `chapters` y `plot_events`/
`plot_promises`. `character_arc_stages`, `character_relationships` y
`chapter_characters` cuelgan a su vez de `characters`/`chapters`. Todo
`ON DELETE CASCADE`, **salvo `plot_promises.payoff_event_id`, que es `SET NULL`**
(ver más abajo).

### Rutas de la API

`api/src/routes/characters.ts` exporta **tres** routers montados en sitios
distintos, porque unas rutas cuelgan del libro y otras del personaje:

| Router | Montaje |
|---|---|
| `bookCharactersRouter` | `/api/books/:bookId/characters` — listar y crear |
| `charactersRouter` | `/api/characters` — detalle, edición, arco, relaciones, foto |
| `relationshipsRouter` | `/api/relationships` — borrado por id |

`api/src/routes/chapters.ts` sigue el mismo patrón:

| Router | Montaje |
|---|---|
| `bookChaptersRouter` | `/api/books/:bookId/chapters` — listar, crear, reordenar |
| `chaptersRouter` | `/api/chapters` — detalle, edición, borrado, reparto |

`api/src/routes/plot.ts` también:

| Router | Montaje |
|---|---|
| `bookPlotRouter` | `/api/books/:bookId/plot` — trama completa, alta y orden de sucesos, alta de promesas |
| `plotEventsRouter` | `/api/plot-events` — edición y borrado de sucesos |
| `plotPromisesRouter` | `/api/plot-promises` — edición y borrado de promesas |

`GET /api/books/:bookId/characters` devuelve una **versión ligera** (sin arco ni
relaciones) porque alimenta una cuadrícula. `GET /api/characters/:id` devuelve el
detalle completo con `arcStages` ordenadas y `relationships` ya resueltas — el
frontend no debe encadenar peticiones para pintar una ficha.

Las mutaciones de personaje devuelven el detalle completo recargado, no el objeto
que devolvió Prisma. Así el cliente puede reemplazar su caché sin refetch.

### Frontend

| Fichero | Qué hace |
|---|---|
| `src/lib/useRoute.ts` | Router de hash propio (ver más abajo) |
| `src/state/useActiveBook.ts` | Libro activo, persistido en `localStorage` |
| `src/api/client.ts` | `fetch` envuelto; traduce errores de red y de zod |
| `src/api/hooks.ts` | Todos los hooks de react-query, con las claves de caché |
| `src/tabs/overview/` | Libro: resumen de sólo lectura de trama + personajes + capítulos, reutiliza los mismos hooks/caché que esas tabs; exporta a Markdown |
| `src/lib/downloadFile.ts` | Dispara la descarga de un fichero de texto generado en el cliente (`Blob` + `<a download>`) |
| `src/tabs/characters/` | Personajes: lista, ficha, formulario, foto, arco, relaciones |
| `src/tabs/chapters/` | Capítulos: lista, ficha, reparto, los dos paneles de texto |
| `src/tabs/plot/` | Trama: línea de sucesos y panel de promesas |
| `src/tabs/books/` | Gestión de libros: alta, edición y borrado (lista simple, sin maestro-detalle). No está en la barra de tabs — ver `NAV_TABS` |
| `src/lib/saveStatus.ts` | Registro global de borradores sin guardar (multi-entrada) + `confirmDiscardUnsaved` |
| `src/lib/useUnsavedChanges.ts` | Registra un borrador (dirty/saving/save) en `saveStatus.ts` |
| `src/lib/useSaveStatus.ts` | Hook de lectura de `saveStatus.ts` (`useSyncExternalStore`) |
| `src/components/SaveIndicator.tsx` | Indicador "Todo guardado"/"Guardar" de la cabecera; único sitio que escucha Ctrl+S y `beforeunload` |
| `src/lib/useOrderDraft.ts` | Borrador local para reordenar una lista con ↑/↓ (capítulos, sucesos), con `dirty` derivado |

El estado del servidor lo lleva **react-query**; el único estado global propio
es el libro activo. No introducir Redux ni Zustand.

El layout maestro-detalle (Personajes, Capítulos) usa la clase compartida
`.master-detail`. En móvil sólo cabe un panel: lo decide el CSS mediante
`data-view`, no un condicional en JS.

## Decisiones que parecen errores y no lo son

- **`PGDATA` apunta a un subdirectorio del volumen** en `docker-compose.yml`.
  Postgres se niega a arrancar sobre la raíz de un bind mount de Windows por
  permisos. No revertir.
- **`age` es `text`, no `int`** — admite "unos cuarenta" o "inmortal".
- **`personalPlot` y `arcSummary` son campos distintos.** La trama es lo que le
  *ocurre* al personaje; el arco es cómo *cambia por dentro*. Un personaje puede
  pasar por mucho sin transformarse. No fusionarlos.
- **`PUT /api/characters/:id/arc` reemplaza la lista entera**, no hay CRUD por
  etapa. La `position` se deriva del índice del array, así que el orden que envía
  el cliente es la verdad. Va en transacción para no borrar el arco si falla el
  alta.
- **Las relaciones son dirigidas y no recíprocas por defecto.** A puede ver a B
  como "mentor" mientras B ve a A como "estorbo" (o no tener ninguna relación
  de vuelta). La inversa **no se crea sola**: hay que pedirla explícitamente
  con `reciprocalType` en `POST /:id/relationships` (checkbox "Añadir también
  la relación inversa" en `RelationshipEditor.tsx`), y con su propio texto —
  "hermano" desde un lado puede ser "hermana" desde el otro. Las dos altas van
  en una única transacción: si la inversa choca con una relación ya existente
  (`P2002`), tampoco se crea la primera.
- **Al reemplazar una foto, el fichero viejo se borra *después* de confirmar el
  nuevo en BD** (`api/src/routes/characters.ts`). Invertir el orden deja al
  personaje apuntando a un fichero inexistente si falla la escritura.
- **`asyncHandler` envuelve todos los handlers async.** Express 4 no captura
  rechazos de promesas: sin el wrapper la petición se cuelga hasta el timeout.
- **No hay react-router.** `react/src/lib/useRoute.ts` es un router de hash de
  ~50 líneas. Dos motivos: todas las versiones publicadas de react-router
  arrastran advisories sin fix, y `react-router-dom` no funciona en React
  Native, así que esta capa hay que reescribirla igual para la APK. La
  necesidad real es tres tabs y un id. No reintroducirlo sin motivo.
- **Las mutaciones siembran la caché con su respuesta** (`qc.setQueryData`) en
  vez de invalidar el detalle, porque la API ya devuelve el personaje completo.
  La *lista* sí se invalida: nombre, rol o foto pueden haber cambiado en ella.
- **`longTextPatch` existe además de `longText`** (`api/src/lib/schemas.ts`).
  `longText` es `.nullish().transform()`: con la clave ausente el transform
  devuelve `null`, zod lo escribe en la salida y Prisma **borra la columna**. En
  un capítulo eso significa que guardar el panel A vaciaría el panel B. Los
  `*UpdateSchema` de capítulo y suceso usan `longTextPatch`, que deja pasar
  `undefined` para que zod omita la clave. No "simplificar" volviendo a
  `longText` + `.partial()`: esa protección es invisible y depende de un
  detalle interno de zod.
- **El PATCH de capítulo se envía sólo con los campos sucios**
  (`ChapterTextPanels.save`, en `react/src/tabs/chapters/`). Enviar el capítulo
  entero pisaría el otro panel con una copia obsoleta y movería cientos de KB
  por guardado.
- **No hay `@@unique([book_id, position])`** en `chapters` ni en `plot_events`.
  Reordenar en transacción pasa por estados con posiciones repetidas. El orden
  lo garantiza el endpoint `PUT .../order`, que exige la lista completa de ids.
- **`setup_event_id` es CASCADE y `payoff_event_id` es SET NULL** en
  `plot_promises`. Borrar el suceso donde se paga devuelve la promesa a
  "pendiente", que es información útil; borrar el de la siembra la deja sin
  sentido, así que se borra con ella.
- **Trama y Capítulos no se tocan entre sí.** Los sucesos de `plot_events` no
  tienen `chapter_id`. Son dos formas distintas de mirar el libro; acoplarlas
  obligaría a rehacer la trama cada vez que se reordenan los capítulos.
- **Dos campos de texto por capítulo (`text_a`/`text_b`), no versiones
  ilimitadas.** Cada uno con su rótulo editable (`text_a_label`/`text_b_label`,
  NOT NULL). Decisión explícita del usuario.
- **`express.json` está en 5 MB**, no 1 MB, porque un capítulo entero cabe en
  `textA`/`textB`. `errorHandler` mapea `entity.too.large` a 413; sin esa rama,
  un cuerpo mayor caía en el 500 genérico.
- **Toda la tab de Trama vive en una sola clave de caché**
  (`['books', bookId, 'plot']`) y las mutaciones devuelven `{ events, promises }`
  enteros, porque borrar un suceso puede arrastrar promesas (cascade en la
  siembra) y dejar otras pendientes (set null en el pago) a la vez.
- **El aviso de "cambios sin guardar" cubre la navegación interna y el cierre
  de pestaña, no el botón Atrás del navegador.** Interceptar `hashchange`
  llega cuando el cambio ya ha ocurrido; revertirlo ensuciaría el historial.
  No merece la pena.
- **`saveStatus.ts` es un registro *multi-entrada*, no el singleton que fue al
  principio.** Un mismo capítulo tiene a la vez el reparto (`ChapterCastEditor`)
  y el texto (`ChapterTextPanels`) como borradores independientes en la misma
  pantalla; un singleton (`guard` en `useRoute.ts`, ya retirado) sólo puede
  recordar el último que se registró y el otro se pierde en silencio. Cada
  `useUnsavedChanges` se registra con un `Symbol` propio; el indicador,
  `confirmDiscardUnsaved` y `Ctrl+S` combinan todas las entradas (dirty si
  *alguna* lo está, guardar afecta a *todas* las que estén sucias). El
  `beforeunload` y el listener de teclado ahora viven en un único sitio
  (`SaveIndicator`), no uno por editor — antes, con varios editores abiertos a
  la vez, cada uno habría disparado su propio guardado con el mismo Ctrl+S.
- **`ArcEditor`, `ChapterCastEditor` y los reordenamientos (`useOrderDraft`)
  también están registrados en `saveStatus`**, no sólo el texto de capítulos:
  todos tienen un modo edición con borrador local y botón Guardar, así que
  cerrar el portátil a mitad de cualquiera de ellos también debía avisar. El
  `dirty` de cada uno se calcula comparando el borrador contra los datos del
  servidor (no basta con "estoy en modo edición"): entrar a editar sin cambiar
  nada no debe marcar el libro como sucio.
- **Hay dos sitios para crear un libro: el `+ Libro` del `BookSelector` en la
  cabecera (alta rápida con título y autor) y "Gestionar libros", también en la
  cabecera (alta completa con sinopsis, más edición y borrado).** Duplicidad
  intencional: el selector debe seguir permitiendo crear sin salir de la tab en
  la que se está trabajando. No fusionarlos en un único componente.
- **La tab Libro (`OverviewTab`) no tiene endpoint propio.** Llama a los
  mismos tres hooks que Trama/Personajes/Capítulos (`usePlot`, `useCharacters`,
  `useChapters`), así que comparte caché con ellos: si ya se visitó alguna de
  esas tabs, Libro no repite la petición. Es deliberadamente de sólo lectura
  — sin botones de editar, borrar ni crear, ni tarjetas clicables — porque su
  propósito es dar una vista de conjunto, no ser una cuarta forma de editar lo
  mismo.
- **"Exportar como Markdown" (`overviewToMarkdown.ts`) se genera enteramente
  en el cliente**, sin endpoint en la API: los datos ya están en memoria
  (mismos hooks que pintan la tab) y el navegador puede disparar la descarga
  con un `Blob` + `<a download>` (`downloadFile.ts`). El Markdown incluye
  exactamente los mismos campos que se ven en pantalla — ni más (nada de
  personalidad, backstory o texto de capítulos) ni menos —, porque el botón
  exporta "esto", no una ficha completa del libro.
- **La gestión de libros (`BooksTab`) no está en la barra de tabs.** Es una
  ruta más (`#/libros`, sigue en `TABS` en `useRoute.ts` para que el router la
  reconozca), pero `NAV_TABS` la excluye de la barra de navegación: se llega
  desde el botón "Gestionar libros" del `BookSelector`, porque es gestión
  puntual, no una vista de trabajo diario como Trama/Personajes/Capítulos.
  Ningún tab queda marcado como activo mientras se está ahí — es intencional,
  no un bug de `aria-selected`.
- **`DELETE /api/books/:id` recoge las `photoUrl` de los personajes del libro
  *antes* de borrar y las limpia *después*** (`api/src/routes/books.ts`), igual
  que al borrar un personaje suelto. Sin esto, borrar un libro dejaba las
  fotos huérfanas en `uploads/characters/` para siempre — la cascada de la BD
  no toca el sistema de ficheros.

## Red y acceso desde el móvil

El objetivo a medio plazo es una APK, así que la app debe ser alcanzable desde el
teléfono en la misma Wi-Fi:

- La API escucha en `0.0.0.0`, no en `localhost`.
- Vite ya lleva `server.host: true` en `vite.config.ts`.
- `react/.env` → `VITE_API_URL` debe llevar la **IP de la máquina**, no
  `localhost` — si no, el móvil se llama a sí mismo.
- CORS está abierto a propósito: no hay auth y el origen del móvil no se conoce
  de antemano.

**Si el móvil da «No se pudo conectar con la API»**, casi siempre es una de dos:

1. `VITE_API_URL` apunta a `localhost`, o a una IP vieja. Es una IP de DHCP:
   **cambia al reiniciar el router**. Mírala con `ipconfig` y actualízala.
2. Se cambió el `.env` sin reiniciar Vite. **Vite no recarga `.env` en
   caliente**; hay que matar el proceso y relanzarlo.

El firewall de Windows suele estar ya resuelto: la Wi-Fi está catalogada como
`Public` y hay reglas que permiten `node.exe` en ese perfil, lo que cubre tanto
el 5173 como el 3000. Comprobar con `Get-NetConnectionProfile` si falla.

Alternativa pendiente si molesta el mantenimiento de la IP: deducir el host de
la API desde `window.location.hostname` en vez de leerlo del `.env`, y así
funcionaría desde cualquier dispositivo sin tocar nada.

## Ficheros y git

`postgres-data/` y `uploads/` están en `.gitignore` (con `.gitkeep` para
conservar las carpetas). Nunca commitearlos. `api/.env` y `react/.env` también
están ignorados; `.env.example` es la plantilla.

**Trampa de codificación:** el `README.md` original venía en UTF-16LE, y editarlo
conserva esa codificación en vez de pasarla a UTF-8 — el resultado se ve como
basura en GitHub. Ya está corregido, pero si un fichero de texto sale ilegible,
comprobarlo con `head -c 2 fichero | xxd -p`: `2320` es UTF-8, `2300` es UTF-16.
Para arreglarlo hay que borrar el fichero y escribirlo de nuevo.

Para borrar la BD entera: `docker compose down && rm -rf postgres-data/pgdata`.

La BD contiene un libro de ejemplo ("La casa del reloj", 3 personajes) sembrado
para verificar la UI. Es descartable.
