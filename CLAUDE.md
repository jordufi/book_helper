# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

App para diseñar una novela **antes** de escribirla: trama, personajes y capítulos.
El diseño completo está en [ARCHITECTURE.md](ARCHITECTURE.md); este fichero recoge
lo que no se deduce leyendo el código.

**Idioma:** el proyecto está en español — comentarios, mensajes de error de la API,
UI y commits. Mantenerlo.

## Estado

`api/`, `react/` y `react-native/` están implementados y verificados.

`react-native/` es una app **independiente**: guarda todo en SQLite dentro del
teléfono, sin API ni red. No comparte código con `react/` (ver más abajo). Su
propio [README](react-native/README.md) explica cómo sacar el APK.

`react-firebase/` es una tercera app, también independiente: mismo diseño e
interfaz que `react/`, pero sin API ni Postgres detrás — los datos viven en
IndexedDB en el navegador y se descargan/abren como JSON. Pensada para
publicarse en Firebase Hosting con un dominio propio. Ver
[la sección propia más abajo](#web-pública-react-firebase) y su
[README](react-firebase/README.md).

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

cd react-native
npx expo start                     # desarrollo
npm run typecheck
npx expo export --platform all     # bundlea Android+iOS: valida el grafo de imports
npx expo-doctor                    # versiones del SDK y schema de app.json
eas build --profile preview --platform android   # APK

cd react-firebase
npm run dev                        # :5173, sin API ni Postgres detrás
npm run typecheck
npm run build                      # tsc -b && vite build -> dist/
firebase deploy --only hosting     # requiere firebase-tools y `firebase use --add`
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
| *(API)* `src/lib/books.ts` | `assertBookExists` (404 si no existe) y `lockBookOrThrow` (lock de fila para el cálculo atómico de `position`) |
| `src/tabs/overview/` | Libro: resumen de sólo lectura de trama + personajes + capítulos, reutiliza los mismos hooks/caché que esas tabs; exporta a Markdown |
| `src/lib/downloadFile.ts` | Dispara la descarga de un fichero de texto generado en el cliente (`Blob` + `<a download>`) |
| `src/tabs/characters/` | Personajes: lista, ficha, formulario, foto, arco, relaciones |
| `src/tabs/chapters/` | Capítulos: lista, ficha, reparto, los dos paneles de texto |
| `src/tabs/plot/` | Trama: línea de sucesos y panel de promesas |
| `src/tabs/books/` | Gestión de libros: alta, edición, borrado, exportar/importar JSON (lista simple, sin maestro-detalle). No está en la barra de tabs — ver `NAV_TABS` |
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
- **El alta de capítulo y de suceso va dentro de `prisma.$transaction` con un
  `SELECT ... FOR UPDATE` sobre la fila del libro** (`lockBookOrThrow`, en
  `api/src/lib/books.ts`). No es paranoia: sin el lock, cuatro altas
  simultáneas en el mismo libro crean cuatro filas con la **misma**
  `position` — reproducido, no teórico. En READ COMMITTED cada transacción lee
  el mismo `MAX(position)` porque no ve las filas aún sin confirmar de las
  otras, así que un `INSERT ... SELECT MAX(position)+1` en una sola sentencia
  **tampoco** bastaría. Y como (por lo de arriba) no hay unique que lo frene,
  la BD acepta las duplicadas y `ORDER BY position` pasa a dar un orden no
  determinista: la lista se reordena sola entre recargas. Importa porque la
  app se usa desde el portátil y el móvil a la vez. El lock serializa sólo las
  altas del mismo libro, que es el alcance exacto en el que compiten.
- **`books.id` es `TEXT`, no `uuid`** (Prisma mapea así `String @id`). En el
  SQL crudo de `lockBookOrThrow` no se puede castear a `::uuid`: fallaría en
  cada llamada.
- **Las rutas anidadas bajo `/books/:bookId` comprueban que el libro exista
  (`assertBookExists`), también las de sólo lectura.** Antes los `GET`
  devolvían `200 []` para un libro inexistente, que le dice al cliente "el
  libro está vacío" cuando la verdad es "no existe" — y encima era incoherente
  con los `POST`, que sí daban 404.
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
- **La tab Libro también tiene un botón "Exportar JSON"** (`useExportBook`),
  junto al de Markdown. No contradice el punto anterior de "sólo lectura": es
  una exportación, no una edición — no crea, borra ni modifica nada, ni abre
  ningún formulario. Es un atajo al mismo `GET /:id/export` que ya usaba
  "Gestionar libros" (mismo hook, mismo fichero resultante); ese sitio sigue
  siendo el único lugar para editar/borrar el libro o importar uno.
- **Exportar/importar libro completo (JSON) sí tiene endpoints propios**
  (`GET /api/books/:id/export`, `POST /api/books/import`), a diferencia del
  Markdown: aquí el propósito es llevarse el libro entero a otro sistema —
  con el texto real de los capítulos, la personalidad y el backstory de cada
  personaje, todo — así que hace falta leer de la BD, no de lo que ya está en
  caché en el cliente.
  - **Sin fotos, a propósito** (por eso lo pidió el usuario): `photoUrl` no
    sale en el export. Las fotos son ficheros en `./uploads/characters`, no
    datos portables en un JSON; incluir la imagen habría significado
    base64 o un `.zip`, que es justo la complejidad que no se quería.
  - **El export conserva los ids reales de personajes y sucesos**, pero sólo
    para que relaciones, reparto y promesas puedan referenciarse entre sí
    *dentro del propio fichero*. El import los descarta enteros y genera ids
    nuevos, remapeando esas referencias con un `Map<idViejo, idNuevo>` — así
    que reimportar el mismo fichero dos veces no colisiona con nada, sólo
    crea dos libros distintos.
  - **El import siempre crea un libro NUEVO**, nunca sobrescribe uno
    existente ni admite "importar dentro de" un libro ya creado. Evita toda
    la complejidad de fusionar/deduplicar contra datos que ya estaban ahí.
  - **Todo el import va en una única transacción** (`prisma.$transaction`),
    personajes → arco + relaciones → capítulos → reparto → sucesos →
    promesas, en ese orden porque cada paso necesita el mapa de ids del
    anterior (una relación puede apuntar a cualquier personaje del libro, no
    sólo a los ya creados, así que las relaciones se crean en una segunda
    pasada una vez existen todos los personajes).
  - **Las relaciones y el reparto se deduplican en memoria antes de
    `createMany`, no con `try/catch` alrededor de cada insert.** Si un insert
    dentro de una transacción de Postgres viola una restricción `@@unique`,
    Postgres marca la transacción entera como abortada — atraparlo en JS no
    la revive, así que todo el import fallaría a la primera relación
    duplicada del JSON. Filtrar antes evita que eso pase.
  - **Una referencia rota en el JSON (un `relatedCharacterId` o
    `setupEventId` que no aparece en el propio fichero) se descarta en
    silencio, no aborta el import.** Es un fichero externo, potencialmente
    editado a mano; fallar todo el import por una fila suelta sería peor que
    perder esa única relación o promesa.
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

## App móvil (`react-native/`)

Expo SDK 57 + `expo-sqlite`. **No habla con `api/`**: los datos viven en el
dispositivo. Decisiones propias que conviene no deshacer:

- **No comparte código con `react/` a propósito.** Se duplican los tipos y el
  schema zod del import. Un paquete compartido obligaría a montar workspaces
  para tres ficheros, y los componentes no se pueden compartir de todas formas
  (`<div>` vs `<View>`). Lo que **sí** está acoplado y debe seguir estándolo es
  el **formato JSON** de export/import: es el puente entre las dos apps.
- **`PRAGMA foreign_keys = ON` al abrir la BD** (`src/db/database.ts`). SQLite
  las trae desactivadas por defecto; sin esa línea los `ON DELETE CASCADE` del
  esquema son decorativos. Va fuera de transacción: dentro se ignora en silencio.
- **`role` es TEXT con CHECK** (SQLite no tiene enums), así que la lista de
  personajes ordena con un `CASE`: alfabéticamente saldría ANTAGONIST antes que
  PROTAGONIST, distinto de la web.
- **Todo lo que lee-y-luego-escribe usa `withExclusiveTransactionAsync`, no
  `withTransactionAsync`.** La documentación de expo-sqlite es explícita: la
  segunda **no aísla** y otras consultas async pueden colarse en medio. Sin
  exclusiva, el `MAX(position)` + `INSERT` del alta de capítulo/suceso sufre
  exactamente la misma carrera que se arregló en Postgres con el `FOR UPDATE`
  (dos altas leen el mismo máximo → posiciones duplicadas → orden no
  determinista). Aplica igual a `saveArc`/`saveCast` (entre el DELETE y los
  INSERT la lista está vacía) y al import completo.
  **Dentro de una transacción exclusiva hay que usar `txn.*`, nunca `db.*`**:
  `db` va por fuera y se quedaría esperando a que la transacción termine.
  La única excepción es la migración en `database.ts`, que no la necesita
  porque `getDb()` memoriza la promesa de apertura y nadie recibe la conexión
  hasta que acaba.
- **`Section` oculta con `display: 'none'`; NUNCA desmonta a sus hijos.**
  Dentro viven editores con borrador local (texto del capítulo, arco,
  reparto), y en React Native un `{open && <View>{children}</View>}` los
  desmonta y se lleva su `useState`: plegar "Texto" con texto sin guardar lo
  destruiría. Y en silencio, porque al desmontarse el editor `useReportUnsaved`
  hace su limpieza y desarma el aviso justo antes de perder los datos. En la
  web no pasa porque plegar allí es CSS sobre un `<div>` sin estado. El flag
  `mounted` sólo retrasa el PRIMER montaje (para `defaultOpen={false}`); una
  vez abierta, la sección ya no se desmonta. Al ocultar hay que sacarla también
  del árbol de accesibilidad, o el lector de pantalla lee campos invisibles.
- **Hay dos selectores y no uno: `Choice` y `Select`** (`src/ui/components.tsx`).
  `Choice` pinta un botón por opción — bien para rol (4) o el panel A/B (2), un
  muro con 40 personajes. `Select` se despliega **en línea** con buscador, y es
  en línea y no un modal a propósito: varios viven dentro de un `Sheet`, que ya
  es un `Modal`, y anidar modales da problemas en ambas plataformas. Por lo
  mismo su lista es un `ScrollView` acotado y no un `FlatList`: dentro de otro
  scroll la virtualización avisa y va peor.
- **Las fichas de detalle vuelven atrás solas si su elemento desaparece**
  (`character === null`, `chapter === null`). Pasa al borrar el libro entero
  desde otra pestaña: la cascada se lleva el elemento y la pantalla se quedaría
  en un "no encontrado" sin salida. Se distingue `null` ("consultado y no
  existe") de `undefined` ("todavía cargando"), que no debe disparar nada.
- **El aviso de cambios sin guardar es `usePreventRemove`
  (`src/lib/unsavedChanges.tsx`), no un indicador en la cabecera** como en la
  web. Cubre el botón atrás, el gesto de deslizar y el atrás de Android. **No**
  cubre cambiar de pestaña, y no hace falta: la pantalla no se desmonta, así
  que el borrador sigue ahí. Es un registro de varias entradas por el mismo
  motivo que `saveStatus.ts` en la web: una ficha de capítulo tiene a la vez el
  texto y el reparto como borradores independientes.
- **`ScreenScroll` usa `automaticallyAdjustKeyboardInsets` en vez de
  `KeyboardAvoidingView`** (`src/ui/components.tsx`). El segundo necesitaría la
  altura de la cabecera de navegación, y `useHeaderHeight` vive en
  `@react-navigation/elements`, que aquí sólo es dependencia **transitiva** —
  importarlo sería depender de un paquete que no declaramos. En el `Sheet` sí
  se usa `KeyboardAvoidingView`, porque dentro de un `Modal` no hay cabecera y
  el offset 0 es correcto.
- **El `KeyboardAvoidingView` del `Sheet` lleva `behavior: 'height'` también en
  Android, no sólo `'padding'` en iOS** (`src/ui/components.tsx`). Un `Modal
  transparent` de React Native en Android se dibuja en su propio Dialog/window,
  que **no** hereda el `windowSoftInputMode="adjustResize"` de la Activity —
  con `behavior: undefined` el teclado tapaba el `Sheet` entero (reproducido:
  el formulario "Nuevo personaje" con `autoFocus` quedaba oculto detrás del
  teclado al abrirse). `ScreenScroll` no tiene este problema porque no vive
  dentro de un `Modal`: ahí sí llega el `adjustResize` real de la Activity.
- **`keyboardShouldPersistTaps="handled"` en todos los scrolls con campos.**
  Sin eso, con el teclado abierto el primer toque en "Guardar" sólo lo cierra y
  hay que tocar dos veces.
- **El libro activo vive en un Context (`ActiveBookProvider`), no en un hook
  con `useState` suelto.** Las pantallas de las pestañas se quedan montadas al
  cambiar de una a otra: si cada una tuviera su copia, cambiar de libro en
  "Libros" no llegaría a las demás. `useActiveBook()` lanza un error si se usa
  fuera del Provider, para que ese fallo sea ruidoso y no silencioso.
- **Pero las fichas de detalle NO usan el libro activo: sacan el `bookId` de la
  entidad que ya han cargado** (`chapter.bookId`, `character.bookId`). Es la
  otra cara de lo anterior: como las pantallas no se desmontan, cambiar de
  libro con una ficha abierta la deja mostrando un capítulo del libro A
  mientras el Context ya dice B. Con el libro activo, el editor de reparto
  pasaba a ofrecer los personajes de B y guardar reventaba con "Los personajes
  deben pertenecer al libro del capítulo"; las relaciones, igual. La entidad
  cargada es la única fuente correcta. El libro activo se queda para las
  pantallas de lista, que sí son "lo que hay en el libro actual".
- **Y por lo mismo, los borradores de reordenar se descartan con un `useEffect`
  sobre `[bookId]`** (`ChaptersScreen`, `PlotScreen`; en `PlotScreen` también
  los formularios de suceso y promesa). Sin eso, un reordenamiento a medias
  sobrevive al cambio de libro y "Guardar orden" manda los ids del libro
  anterior. Aquí sí toca el libro activo, porque son pantallas de lista.
- **El recuento de palabras del capítulo va sobre `useDeferredValue`**
  (`ChapterDetailScreen`), no calculado directo en el render. Recorre el texto
  entero, que puede ser un capítulo de cientos de KB: hacerlo en cada tecla se
  nota al escribir. Diferido, React pinta la pulsación primero y recalcula
  cuando hay hueco; el número va un instante por detrás mientras se escribe
  seguido, que es el compromiso que queremos. Un `useMemo` a secas no serviría:
  la dependencia sería el propio texto, que cambia en cada tecla.
- **El selector de fichero del import acepta tres MIME, no sólo
  `application/json`** (`BooksScreen`). En Android el MIME lo pone el proveedor
  del fichero, y un `.json` llegado por correo, Drive o el gestor de archivos
  se anuncia a menudo como `text/plain` o `application/octet-stream`: con el
  filtro estricto sale en gris y no se puede elegir el propio export. No relaja
  ninguna validación — lo que valida de verdad es el `JSON.parse` y el schema
  de zod de `transferSchema.ts`.
- **Migraciones por `PRAGMA user_version`** (`src/db/schema.ts`). Para cambiar
  el esquema se añade una entrada al final de `MIGRATIONS`; **nunca** se edita
  una ya publicada, porque los dispositivos que la aplicaron no la repetirán.
- **`transferSchema.ts` está separado de `transfer.ts`** para que la validación
  no importe nada de Expo y se pueda ejecutar fuera del móvil. Es lo que
  permite verificar con un script que un export real de la web sigue pasando la
  validación del móvil.
- **`expo-sqlite/kv-store` en vez de AsyncStorage** para el libro activo: misma
  API, y ya tenemos expo-sqlite.
- **Emoji como iconos de pestaña**, para no arrastrar una librería de iconos.
- **`android/` e `ios/` están gitignored**: los genera `expo prebuild`, son
  artefactos.
- **`eas.json` fuerza `buildType: apk`** en los perfiles `preview` y
  `production`. Por defecto EAS produce `.aab`, que no se instala en el móvil.
- **`npm run android` (`expo run:android`) instala una build *debug* con
  dev-client, que necesita Metro corriendo en el PC.** Sin el PC conectado (ni
  siquiera en la misma Wi-Fi) sale "Unable to load script. Make sure you're
  running Metro..." — reproducido, no es un bug de la app. Para una app
  autónoma sin PC hace falta un build *release*: `npm run android:release`
  (`expo run:android --variant release`, local) o `eas build --profile
  preview` (en la nube, mismo `buildType: apk` de arriba). Ver
  [react-native/README.md](react-native/README.md#generar-el-apk-y-ios).

## Web pública (`react-firebase/`)

Fork de `react/` para publicarlo en Firebase Hosting (sólo estáticos) con un
dominio propio, sin pagar por un servidor ni por una base de datos, y sin
usuarios concurrentes. Decisiones propias que conviene no deshacer:

- **Es un fork, no código compartido con `react/`**, por el mismo motivo que
  ya justifica `react-native/`: el puente entre las apps es el **formato
  JSON** de export/import, no los módulos. Intentar compartir componentes
  entre una app con servidor y otra sin él habría acoplado ambas a una capa de
  abstracción que sólo una de las dos necesita.
- **El seam es exactamente `src/api/client.ts` + `src/api/hooks.ts`**, los
  mismos dos ficheros que en `react/` (66 + 361 líneas allí). Los otros ~35
  ficheros de `react/src/` no saben que existe una API, así que se copiaron a
  `react-firebase/` sin tocar una línea (salvo quitar las fotos, ver abajo).
  `hooks.ts` mantiene los mismos nombres de hook, las mismas claves de caché y
  las mismas invalidaciones — sólo cambia el cuerpo de cada
  `queryFn`/`mutationFn`, que llama a `src/store/` en vez de a `fetch`. Un
  arreglo en la lógica de negocio de `react/` se porta a mano con un
  copy-paste de la función correspondiente.
- **Se conserva react-query aunque no haya red que cachear.** Quitarlo
  obligaría a reescribir los ~20 componentes que consumen `isPending`,
  `error`, `mutateAsync`, `data`. Con él, esos componentes se copiaron tal
  cual. El coste es una capa de indirección sobre funciones síncronas:
  irrelevante. En `main.tsx` el `QueryClient` usa
  `staleTime: Infinity, gcTime: Infinity, retry: false`: sin servidor,
  "obsoleto" no significa nada — los datos sólo cambian cuando una mutación
  local los toca, y esa misma mutación ya actualiza la caché.
- **`src/store/` es el "backend": un documento único en memoria, persistido en
  IndexedDB.** `store.ts` expone una función por cada operación que antes era
  una ruta de la API (crear personaje, guardar arco, borrar suceso…), y
  `select.ts` arma a mano los mismos joins que hacía el `include`/`select` de
  Prisma para devolver exactamente las formas de `src/types.ts`. Si esas
  formas no coinciden, los componentes se rompen en silencio.
- **IndexedDB y no `localStorage`.** `textA`/`textB` admiten 200.000
  caracteres cada uno (ver más arriba); con dos o tres libros con capítulos
  escritos se pasa de sobra el límite de ~5 MB de `localStorage` y `setItem`
  lanza `QuotaExceededError`. El guardado lleva un debounce de 300 ms para no
  escribir en IndexedDB en cada tecla, con un `flush` síncrono en
  `visibilitychange` → `hidden` para no perder el último cambio si se cierra
  la pestaña a medio debounce.
- **`newId()` (`src/store/ids.ts`) necesita un fallback manual.**
  `crypto.randomUUID()` sólo existe en contexto seguro (HTTPS o `localhost`),
  y este proyecto verifica la UI adrede cargándola por la IP de red
  (`http://192.168.x.x:5173`, ver más abajo) para detectar justo este tipo de
  fallo. Sin el fallback (`crypto.getRandomValues` armando un uuid v4 a mano,
  y como último recurso un id no-uuid), crear cualquier cosa reventaría
  exactamente en el escenario que se comprueba.
- **`main.tsx` espera a `initStore()` antes de montar React.**
  `state/useActiveBook.ts` (copiado sin tocar) borra la entrada de
  `localStorage` del libro activo en cuanto ve `useBooks()` devolver una lista
  que no lo contiene. Si el primer render ocurriera con el store todavía
  vacío (antes de leer IndexedDB), ese efecto interpretaría "libro borrado" y
  el libro activo se perdería en cada recarga de la página.
- **Las validaciones reutilizan literalmente los schemas de zod de la API**
  (`src/store/schemas.ts`, copiado de `api/src/lib/schemas.ts`), con una única
  diferencia: los campos que allí exigían formato `uuid()` aquí sólo exigen
  una cadena no vacía, porque el fallback de `newId()` no siempre produce ese
  formato y la referencia ya se comprueba por existencia. Reutilizar los
  schemas (en vez de reescribir a mano la lógica) es lo que conserva intacta
  la distinción `longText`/`longTextPatch` que evita que guardar el panel A de
  un capítulo vacíe el panel B — es la parte más fácil de romper si se
  reimplementa desde cero.
- **Sin locks ni transacciones.** JS es monohilo y hay un único usuario por
  navegador, así que la carrera que `lockBookOrThrow` resolvía en la API (dos
  altas a la vez calculando la misma `position`) no puede darse aquí. La única
  operación que sí necesita "todo o nada" es el import completo de un libro
  (`src/store/transfer.ts`): se construye sobre una **copia** del documento y
  sólo se confirma al final con `replaceData()`, el equivalente sin
  `prisma.$transaction`.
- **`src/store/transferSchema.ts` es una copia literal de
  `react-native/src/db/transferSchema.ts`.** Ya estaba escrito para validar el
  formato v1 fuera de una base de datos; duplicarlo una vez más (en vez de
  compartirlo) sigue la misma decisión que `react-native/` ya tomó: el puente
  entre las tres apps es el fichero JSON, no el código que lo valida.
- **Sin fotos de personaje en esta versión.** Sin servidor no hay dónde
  guardar el fichero de la imagen (ni fotos como base64 en el JSON: se
  descartó por engordar el fichero para poco beneficio). `Avatar`
  (`components/ui.tsx`) perdió la prop `src` y siempre pinta la inicial del
  nombre — ya tenía ese fallback en `react/`, así que ningún sitio se queda
  con un hueco vacío. El formato de export/import ya excluía las fotos desde
  el principio (son ficheros en `./uploads`, no datos portables), así que no
  se pierde nada respecto a lo que hoy es interoperable entre `react/` y
  `react-native/`.
- **El navegador guarda varios libros; el fichero sigue siendo uno.** Abrir un
  JSON crea un libro nuevo junto a los que ya hubiera en este navegador
  (idéntico a como importa hoy `react/`); descargar vuelca un único libro. El
  selector de libro y "Gestionar libros" se mantuvieron tal cual porque
  IndexedDB ya persiste entre sesiones — recortar a un solo libro no habría
  simplificado nada y sí habría tirado UI que ya funciona.
- **Cada libro lleva un aviso de "sin descargar"** (`undownloaded` en
  `WorkspaceData`, con badge en `BooksTab`) cuando tiene cambios desde la
  última vez que se descargó su JSON — incluido nada más crearlo o editarlo.
  Un libro recién **abierto** desde un fichero NO se marca así: el usuario
  acaba de dármelo, ya tiene una copia en su disco. Es la única asimetría
  entre "crear/editar" y "abrir" a la hora de marcar este flag.

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
