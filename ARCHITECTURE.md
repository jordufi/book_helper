# Book Helper — Arquitectura

Documento de diseño. Describe **qué** hay que construir y **por qué**, no el código.
El objetivo del proyecto es apoyar un flujo de trabajo en el que la trama, los
capítulos y los personajes se diseñan **antes** de empezar a escribir.

> **Estado actual:** la infraestructura de Postgres, `api/` y `react/` están
> implementados y verificados. Las tres tabs (Personajes, Capítulos, Trama)
> funcionan.

---

## 1. Decisiones ya tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Backend | Node + Express + Prisma (TypeScript) | El navegador no puede abrir TCP contra Postgres. La misma API la reutilizará React Native. |
| Fotos | Fichero en `./uploads` + ruta en BD | Mantiene la BD ligera y sirve las imágenes por HTTP a web y móvil por igual. |
| Alcance | Varios libros | Añadir `book_id` ahora es una columna; añadirlo después obliga a migrar datos. |
| Auth | Ninguna | Uso local. El modelo de datos no impide añadirla luego. |

**Decisiones de diseño de Capítulos y Trama:**

| Decisión | Elección | Motivo |
|---|---|---|
| Texto del capítulo | Dos campos fijos (`text_a`/`text_b`) con rótulo editable | Escribir es iterativo, pero un historial ilimitado de versiones no es lo que se pidió |
| Reparto del capítulo | Personaje + qué hace (texto libre), reemplazo total | Corto y editado entero, igual que el arco de personaje |
| Promesas | Entidad propia que une un suceso-siembra y un suceso-pago (nullable = pendiente) | No es un "tipo" del suceso: una promesa puede pagarse mucho después, o nunca |
| Acoplamiento Trama↔Capítulos | Ninguno | Son dos formas distintas de mirar el libro; acoplarlas obligaría a rehacer la trama al reordenar capítulos |
| Guardado del texto | Explícito, con indicador de cambios, Ctrl+S y aviso al salir | Coherente con "guardado explícito, no autoguardado" del resto de la app |

---

## 2. Estructura de carpetas

```
book_helper/
├── docker-compose.yml      # Postgres + Adminer          [HECHO]
├── .env.example            # plantilla de config          [HECHO]
├── .gitignore                                             [HECHO]
├── README.md               # cómo arrancar                [HECHO]
├── ARCHITECTURE.md         # este documento               [HECHO]
├── postgres-data/          # volumen de la BD (gitignored)[HECHO]
├── uploads/characters/     # fotos (gitignored)           [HECHO]
├── api/                    # Express + Prisma             [HECHO]
├── react/                  # Vite + React                 [HECHO]
└── react-native/           # vacío, trabajo futuro
```

`react-native/` se deja vacío a propósito. **No crear nada dentro.**

---

## 3. Topología

Sólo Postgres va en Docker. La API y el frontend se ejecutan en local durante el
desarrollo para conservar el hot-reload.

```
┌────────────┐   HTTP :3000   ┌────────────┐   TCP :5432   ┌────────────┐
│  react     │ ─────────────► │    api     │ ────────────► │  postgres  │
│  Vite:5173 │                │  Express   │               │  (docker)  │
└────────────┘                └────────────┘               └────────────┘
      │                             │                            │
      │      GET /uploads/*         │                            ▼
      └────────────────────────────►┘                    ./postgres-data
                                    │
                                    ▼
                             ./uploads/characters
```

**Puertos:** Postgres `5432`, API `3000`, Vite `5173`, Adminer `8081`.

Para abrirlo desde el móvil hay que arrancar Vite con `--host` y poner en
`VITE_API_URL` la IP de la máquina, no `localhost` (si no, el móvil se llamaría a
sí mismo). La API debe permitir CORS desde la red local.

---

## 4. Modelo de datos

Ocho tablas. `books` es la raíz; todo lo demás cuelga de ella y se borra en
cascada, salvo `plot_promises.payoff_event_id`, que es `SET NULL`.

```
books ──1:N──► characters ──1:N──► character_arc_stages
       │            │
       │            └───1:N──► character_relationships ──► characters
       │
       ├──1:N──► chapters ──1:N──► chapter_characters ──► characters
       │
       └──1:N──► plot_events ◄──setup (CASCADE)──┐
                       ▲                         plot_promises
                       └──payoff (SET NULL)───────┘
```

### `books`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `title` | text NOT NULL | |
| `author` | text NULL | |
| `synopsis` | text NULL | |
| `created_at` / `updated_at` | timestamptz | |

### `characters`
El núcleo de la entrega. Los campos largos son `text` libre: en esta fase de
diseño de personaje conviene no encorsetar al autor.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | `ON DELETE CASCADE` |
| `name` | text NOT NULL | único campo obligatorio |
| `role` | enum | `PROTAGONIST` / `ANTAGONIST` / `SECONDARY` / `EXTRA` |
| `age` | text NULL | **text, no int** — permite "unos 40", "inmortal" |
| `photo_url` | text NULL | ruta relativa, p.ej. `/uploads/characters/<uuid>.webp` |
| `physical_description` | text NULL | |
| `personality` | text NULL | |
| `backstory` | text NULL | qué le pasó **antes** de empezar el libro |
| `personal_plot` | text NULL | qué le pasa **durante** el libro |
| `arc_summary` | text NULL | el arco en una frase; el detalle va en las etapas |
| `notes` | text NULL | cajón de sastre |
| `created_at` / `updated_at` | timestamptz | |

`personal_plot` y `arc_summary` son cosas distintas y el usuario las pidió por
separado: la trama es lo que **le ocurre**; el arco es cómo **cambia por dentro**.
No fusionarlas en un solo campo.

### `character_arc_stages`
El arco como línea de tiempo ordenada (p.ej. *punto de partida → detonante →
crisis → transformación*).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `character_id` | uuid FK | `ON DELETE CASCADE` |
| `position` | int NOT NULL | orden dentro del arco, base 0 |
| `title` | text NOT NULL | |
| `description` | text NULL | |

Índice en `(character_id, position)`.

### `character_relationships`
Dirigida y no recíproca automáticamente: A puede ver a B como "mentor" mientras B
ve a A como "estorbo". Esa asimetría es útil y hay que preservarla.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `character_id` | uuid FK | el sujeto |
| `related_character_id` | uuid FK | el objeto |
| `type` | text NOT NULL | libre: "hermano", "rival", "amante" |
| `description` | text NULL | |

Restricciones: `CHECK (character_id <> related_character_id)` y único en
`(character_id, related_character_id, type)`.

### `chapters`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | `ON DELETE CASCADE` |
| `position` | int NOT NULL | orden dentro del libro, base 0 |
| `title` | text NOT NULL | |
| `synopsis` | text NULL | qué ocurre en el capítulo — el diseño, no el texto |
| `notes` | text NULL | |
| `text_a_label` / `text_b_label` | text NOT NULL | rótulos editables, por defecto "Borrador"/"Reescritura" |
| `text_a` / `text_b` | text NULL | los dos textos del capítulo. Nunca viajan en una lista ni en un reemplazo masivo |
| `created_at` / `updated_at` | timestamptz | |

Sin `@@unique([book_id, position])`: el endpoint de reordenar pasa por estados
con posiciones repetidas dentro de una transacción.

### `chapter_characters`

Un personaje en un capítulo y qué hace en él.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `chapter_id` | uuid FK | `ON DELETE CASCADE` |
| `character_id` | uuid FK | `ON DELETE CASCADE` |
| `position` | int NOT NULL | orden del reparto dentro del capítulo |
| `action` | text NULL | qué hace, texto libre |

Único en `(chapter_id, character_id)`: un personaje no puede repetirse en el
reparto de un mismo capítulo.

### `plot_events`

La línea de tiempo de la trama. Sin relación con los capítulos a propósito.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | `ON DELETE CASCADE` |
| `position` | int NOT NULL | orden en la línea de tiempo, base 0 |
| `title` | text NOT NULL | |
| `description` | text NULL | |
| `created_at` / `updated_at` | timestamptz | |

Sin `@@unique([book_id, position])`, mismo motivo que en `chapters`.

### `plot_promises`

Une dos sucesos: dónde se siembra algo y dónde se paga.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | `ON DELETE CASCADE`. Denormalizado desde `setup_event_id` para listar/validar sin join |
| `title` | text NOT NULL | |
| `description` | text NULL | |
| `setup_event_id` | uuid FK → plot_events | `ON DELETE CASCADE` — una promesa sin siembra no significa nada |
| `payoff_event_id` | uuid FK → plot_events, NULL | `ON DELETE SET NULL` — `NULL` es "pendiente", el estado que interesa vigilar |

Sin CHECK `setup_event_id <> payoff_event_id`: sembrar y pagar en el mismo
suceso es legítimo. Tampoco se valida que el pago sea posterior a la siembra
(puede ser un flashback); la UI lo señala con un badge, la BD no lo impide.

---

## 5. API REST

Base `http://<host>:3000/api`. JSON en cuerpo y respuesta. Errores con el código
HTTP correcto y `{ "error": "mensaje" }`.

### Libros
```
GET    /api/books                    lista
POST   /api/books                    crea
GET    /api/books/:id                detalle
PATCH  /api/books/:id                actualiza (parcial)
DELETE /api/books/:id                borra (cascada a personajes)
```

### Personajes
```
GET    /api/books/:bookId/characters   lista del libro
POST   /api/books/:bookId/characters   crea en el libro
GET    /api/characters/:id             detalle + etapas + relaciones
PATCH  /api/characters/:id             actualiza (parcial)
DELETE /api/characters/:id             borra
```

`GET /api/characters/:id` devuelve el personaje **con** sus `arcStages` (ordenadas
por `position`) y sus `relationships` (con el nombre y foto del otro personaje
incluidos, para no obligar al frontend a encadenar peticiones).

`GET /api/books/:bookId/characters` devuelve la versión ligera — sin etapas ni
relaciones — porque alimenta una cuadrícula de tarjetas.

### Arco
```
PUT    /api/characters/:id/arc       reemplaza la lista ordenada completa
```

Un `PUT` que sustituye el array entero, no CRUD por etapa. El frontend reordena
con drag & drop y guarda el resultado; hacerlo por elemento obligaría a
sincronizar `position` con varias peticiones y a gestionar estados intermedios.

### Relaciones
```
POST   /api/characters/:id/relationships    crea
DELETE /api/relationships/:id               borra
```

### Foto
```
POST   /api/characters/:id/photo     multipart/form-data, campo "photo"
DELETE /api/characters/:id/photo     borra fichero y pone photo_url a NULL
```

Reglas de subida: sólo `image/jpeg|png|webp`, máximo 5 MB, nombre generado por el
servidor (uuid — nunca el nombre original del cliente, que es entrada no
confiable), y borrado del fichero anterior al reemplazar para no dejar huérfanos.

`/uploads` se sirve como estático desde Express.

### Capítulos
```
GET    /api/books/:bookId/chapters        lista ligera (sin textA/textB)
POST   /api/books/:bookId/chapters        crea (nace sin texto)
PUT    /api/books/:bookId/chapters/order  reordena la lista entera
GET    /api/chapters/:id                  detalle + reparto resuelto
PATCH  /api/chapters/:id                  actualiza — SÓLO los campos enviados
DELETE /api/chapters/:id                  borra
PUT    /api/chapters/:id/cast             reemplaza el reparto entero
```

`PATCH` es parcial de verdad: enviar sólo `textB` no toca `textA`. Un capítulo
entero puede pesar cientos de KB, así que — a diferencia del arco de
personaje — aquí **no** hay un reemplazo masivo tipo `PUT`; el cliente decide
qué campos cambiaron y sólo esos viajan. El reparto (`PUT .../cast`) sí es
reemplazo total, como el arco: es una lista corta que el editor ya tiene
entera en memoria.

### Trama
```
GET    /api/books/:bookId/plot                    { events, promises } del libro
POST   /api/books/:bookId/plot/events             crea un suceso
PUT    /api/books/:bookId/plot/events/order       reordena la línea de tiempo
PATCH  /api/plot-events/:id                       edita un suceso
DELETE /api/plot-events/:id                       borra (cascada a sus promesas-siembra)
POST   /api/books/:bookId/plot/promises           crea una promesa
PATCH  /api/plot-promises/:id                     edita — incluye marcar/desmarcar el pago
DELETE /api/plot-promises/:id                      borra
```

Toda mutación de trama devuelve `{ events, promises }` recargado, nunca sólo el
elemento tocado: borrar un suceso puede arrastrar promesas sembradas en él
(cascade) y a la vez devolver otras a "pendiente" (sus pagos, set null). Sólo
así el cliente puede reconstruir la vista con una sola respuesta.

---

## 6. Frontend

### Estructura
```
react/src/
├── main.tsx, App.tsx
├── api/client.ts, hooks.ts    fetch envolviendo VITE_API_URL + hooks de react-query
├── lib/
│   ├── useRoute.ts            router de hash propio, con guarda de navegación
│   ├── useUnsavedChanges.ts   indicador + Ctrl+S + aviso al salir/navegar
│   └── useOrderDraft.ts       borrador local para reordenar con ↑/↓
├── components/
│   ├── BookSelector.tsx       desplegable de libro activo
│   └── ui.tsx                 Modal, ConfirmDialog, Section, Prose, Spinner, ErrorBanner…
├── tabs/
│   ├── characters/            Personajes: lista, ficha, formulario, foto, arco, relaciones
│   ├── chapters/               Capítulos: lista, ficha, reparto, paneles de texto
│   │   ├── ChaptersTab.tsx, ChapterForm.tsx, ChapterDetail.tsx
│   │   ├── ChapterCastEditor.tsx      quién sale y qué hace
│   │   └── ChapterTextPanels.tsx      los dos paneles, guardado explícito
│   └── plot/                   Trama: línea de sucesos y promesas
│       ├── PlotTab.tsx, PlotTimeline.tsx, PlotEventForm.tsx
│       └── PromisesPanel.tsx, PromiseForm.tsx
└── types.ts
```

### Layout
Cabecera con el selector de libro, debajo las tres tabs. La tab activa vive en
la URL (router de hash propio, no react-router) para que recargar no pierda el
sitio.

Personajes y Capítulos son **maestro-detalle**, con la clase CSS compartida
`.master-detail`: lista a la izquierda, ficha del seleccionado a la derecha. En
pantalla estrecha, la ficha pasa a ocupar todo y la lista se oculta — esto
importa porque el objetivo a medio plazo es una APK.

### Ficha de personaje
Secciones plegables, en este orden: Identidad (foto, nombre, rol, edad) ·
Descripción física · Personalidad · Historia previa · Trama personal · Arco
(resumen + etapas) · Relaciones · Notas.

### Ficha de capítulo
Secciones plegables: Sinopsis · Reparto (quién sale y qué hace, editado como el
arco de personaje) · Texto (los dos paneles, abierta por defecto) · Notas.

### Tab de Trama
Dos columnas: la línea de tiempo de sucesos a la izquierda (con badges de qué
promesas se siembran/pagan en cada uno), y a la derecha un panel fijo de
promesas agrupadas en Pendientes/Cumplidas, con acceso directo para marcar el
pago. En móvil el panel de promesas pasa a ir primero, antes que la línea de
tiempo.

### Estado
TanStack Query para todo lo que venga del servidor — da caché, refetch e
invalidación sin escribir reducers. El único estado global propio es el libro
activo (persistido en `localStorage`). **No añadir Redux ni Zustand.**

### Formularios
`react-hook-form` + `zod`. Sólo `name`/`title` es obligatorio en cada alta: el
autor debe poder esbozar un personaje o un capítulo y rellenarlo más tarde.

Guardado explícito con botón, no autoguardado. En campos de texto largos el
autoguardado dispara escrituras a media frase y complica el "deshacer". Los
paneles de texto del capítulo, que además pueden tardar en escribirse, añaden
un indicador de "cambios sin guardar", el atajo Ctrl/Cmd+S y un aviso
(`window.confirm`) antes de navegar a otro capítulo o tab, o de cerrar la
pestaña, si hay algo sin guardar.

---

## 7. Orden de implementación

Personajes:

1. `api/`: Prisma schema → migración → CRUD de libros. Verificar contra la BD.
2. `api/`: CRUD de personajes, luego arco, luego relaciones, luego subida de foto.
3. `react/`: andamiaje Vite + tabs + selector de libro. Comprobar que la
   navegación funciona.
4. `react/`: cuadrícula de personajes y ficha en lectura.
5. `react/`: formulario de alta/edición y borrado.
6. `react/`: subida de foto, editor de arco, editor de relaciones.

Capítulos y Trama, añadido después:

7. Refactor preparatorio: `Section`/`Prose` compartidos, `.master-detail`
   genérico, `Route.itemId` genérico (antes `characterId`).
8. `api/`: schema + migración de `chapters`/`chapter_characters`, zod
   (`longTextPatch`), rutas, límite de `express.json` a 5 MB.
9. `api/`: schema + migración de `plot_events`/`plot_promises`, zod, rutas.
10. `react/`: tipos, hooks, `useUnsavedChanges`, `useOrderDraft`.
11. `react/`: lista, alta y ficha de capítulos en lectura.
12. `react/`: editor de reparto.
13. `react/`: los dos paneles de texto, con guardado explícito y aviso.
14. `react/`: reordenar capítulos.
15. `react/`: línea de tiempo de sucesos.
16. `react/`: panel de promesas.
17. Comprobar acceso desde el móvil (IP en `VITE_API_URL`, no `localhost`).

Cada paso debería dejar la app en un estado ejecutable.

---

## 8. Advertencias

- **No tocar `PGDATA` en `docker-compose.yml`.** Apunta a un subdirectorio porque
  Postgres falla al arrancar sobre un bind mount de Windows si escribe en la raíz
  del volumen. Ya está probado y funcionando.
- **`postgres-data/` y `uploads/` nunca se commitean.** Ya están en `.gitignore`.
- **No crear nada en `react-native/`.**
- **Trama y Capítulos no se acoplan entre sí.** Los sucesos de la trama no
  llevan `chapter_id`: son dos formas distintas de mirar el libro.
- **`longTextPatch` (no `longText`) en los `*UpdateSchema` de capítulo y
  suceso**, para que un PATCH parcial no borre un campo que no se envió. Ver
  el detalle en CLAUDE.md.
- **No hay `@@unique([book_id, position])`** en `chapters` ni `plot_events`:
  reordenar en transacción pasa por posiciones repetidas. El orden lo garantiza
  el endpoint `PUT .../order`.
- El puerto 8080 puede estar ocupado; Adminer usa el 8081.
