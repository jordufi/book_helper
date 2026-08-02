# Book Helper — Arquitectura

Documento de diseño. Describe **qué** hay que construir y **por qué**, no el código.
El objetivo del proyecto es apoyar un flujo de trabajo en el que la trama, los
capítulos y los personajes se diseñan **antes** de empezar a escribir.

> **Estado actual:** la infraestructura de Postgres (`docker-compose.yml`, volumen,
> `.gitignore`) ya está creada y verificada. Falta implementar `api/` y `react/`.

---

## 1. Decisiones ya tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Backend | Node + Express + Prisma (TypeScript) | El navegador no puede abrir TCP contra Postgres. La misma API la reutilizará React Native. |
| Fotos | Fichero en `./uploads` + ruta en BD | Mantiene la BD ligera y sirve las imágenes por HTTP a web y móvil por igual. |
| Alcance | Varios libros | Añadir `book_id` ahora es una columna; añadirlo después obliga a migrar datos. |
| Auth | Ninguna | Uso local. El modelo de datos no impide añadirla luego. |

**Fuera de alcance por ahora:** las tabs de Trama y Capítulos son sólo placeholders
(seleccionables, muestran un título). No se les diseña esquema ni endpoints todavía.

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
├── api/                    # Express + Prisma             [PENDIENTE]
├── react/                  # Vite + React                 [PENDIENTE]
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

Cuatro tablas. `books` es la raíz; todo lo demás cuelga de ella y se borra en
cascada.

```
books ──1:N──► characters ──1:N──► character_arc_stages
                    │
                    └───1:N──► character_relationships ──► characters
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

---

## 6. Frontend

### Estructura
```
react/src/
├── main.tsx, App.tsx
├── api/client.ts              fetch envolviendo VITE_API_URL
├── components/
│   ├── BookSelector.tsx       desplegable de libro activo
│   ├── Tabs.tsx               Trama | Personajes | Capítulos
│   └── ui/                    Button, Input, Textarea, Modal, ConfirmDialog
├── tabs/
│   ├── PlotTab.tsx            PLACEHOLDER: sólo <h1>Trama</h1>
│   ├── ChaptersTab.tsx        PLACEHOLDER: sólo <h1>Capítulos</h1>
│   └── characters/            ← toda la entrega real
│       ├── CharactersTab.tsx      layout: lista + detalle
│       ├── CharacterGrid.tsx      tarjetas con foto y nombre
│       ├── CharacterForm.tsx      alta/edición
│       ├── PhotoUpload.tsx        preview + subida
│       ├── ArcEditor.tsx          etapas ordenables
│       └── RelationshipEditor.tsx
└── types.ts
```

### Layout
Cabecera con el selector de libro, debajo las tres tabs. La tab activa vive en
la URL (`react-router`) para que recargar no pierda el sitio.

La tab de Personajes es **maestro-detalle**: cuadrícula de tarjetas a la
izquierda, ficha del seleccionado a la derecha. En pantalla estrecha, la ficha
pasa a ocupar todo y la cuadrícula se oculta — esto importa porque el objetivo a
medio plazo es una APK.

### Ficha de personaje
Secciones plegables, en este orden: Identidad (foto, nombre, rol, edad) ·
Descripción física · Personalidad · Historia previa · Trama personal · Arco
(resumen + etapas) · Relaciones · Notas.

### Estado
TanStack Query para todo lo que venga del servidor — da caché, refetch e
invalidación sin escribir reducers. El único estado global propio es el libro
activo (Context, persistido en `localStorage`). **No añadir Redux ni Zustand.**

### Formularios
`react-hook-form` + `zod`, compartiendo los esquemas de validación con la API si
es posible. Sólo `name` es obligatorio: el autor debe poder crear un personaje
esbozado y rellenarlo más tarde.

Guardado explícito con botón, no autoguardado. En campos de texto largos el
autoguardado dispara escrituras a media frase y complica el "deshacer".

---

## 7. Orden de implementación sugerido

1. `api/`: Prisma schema → migración → CRUD de libros. Verificar contra la BD.
2. `api/`: CRUD de personajes, luego arco, luego relaciones, luego subida de foto.
3. `react/`: andamiaje Vite + tabs + selector de libro, con las tres tabs como
   placeholder. Comprobar que la navegación funciona.
4. `react/`: cuadrícula de personajes y ficha en lectura.
5. `react/`: formulario de alta/edición y borrado.
6. `react/`: subida de foto, editor de arco, editor de relaciones.
7. Comprobar acceso desde el móvil (`--host` + IP en `VITE_API_URL`).

Cada paso debería dejar la app en un estado ejecutable.

---

## 8. Advertencias

- **No tocar `PGDATA` en `docker-compose.yml`.** Apunta a un subdirectorio porque
  Postgres falla al arrancar sobre un bind mount de Windows si escribe en la raíz
  del volumen. Ya está probado y funcionando.
- **`postgres-data/` y `uploads/` nunca se commitean.** Ya están en `.gitignore`.
- **No crear nada en `react-native/`.**
- **Trama y Capítulos son placeholders.** No inventarles esquema ni endpoints.
- El puerto 8080 puede estar ocupado; Adminer usa el 8081.
