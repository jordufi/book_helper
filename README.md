# Book Helper

Aplicación para diseñar una novela antes de escribirla: trama, personajes y
capítulos. Pensada para un flujo en el que todo se planifica desde el principio.

El diseño completo está en [ARCHITECTURE.md](ARCHITECTURE.md).

## Estado

| Parte | Estado |
|---|---|
| Postgres + volumen persistente | ✅ funcionando |
| `api/` (Express + Prisma) | ✅ funcionando |
| `react/` — tabs Trama, Personajes, Capítulos y Libros | ✅ funcionando |
| `react-native/` | 🔮 futuro |

La tab de Personajes permite crear y editar personajes, subir y quitar su foto,
construir el arco como una línea de tiempo ordenable, y relacionarlos entre sí
(incluida la relación inversa, opcional, con su propio texto: "hermano" en un
sentido y "hermana" en el otro).

La tab de Capítulos es una lista ordenable de capítulos; cada uno tiene su
reparto (qué personajes salen y qué hacen) y su texto en **dos paneles**
lado a lado, cada uno con un rótulo editable ("Borrador"/"Reescritura" por
defecto), pensados para iterar sobre el mismo capítulo. El guardado es
explícito (botón o Ctrl+S), con aviso si intentas salir con cambios sin guardar.

Arriba, junto al selector de libro, hay un indicador de guardado: "Todo
guardado" o "Cambios sin guardar" con un botón para guardarlo todo de una vez.
Vigila cualquier borrador abierto en toda la app (arco de personaje, reparto de
un capítulo, su texto, reordenamientos…), así que cerrar el portátil o el
móvil con el indicador en verde significa que no se pierde nada.

La tab de Trama es una línea de tiempo de sucesos con **promesas**: cada
promesa se siembra en un suceso y, opcionalmente, se paga en otro. Un panel
aparte agrupa las promesas pendientes y las cumplidas.

La tab de Libros gestiona los libros en sí: crear, editar y borrar. Borrar uno
se lleva por delante sus personajes, capítulos y trama (la app avisa antes).

## Stack

React + Vite · Express + Prisma (TypeScript) · PostgreSQL 16 en Docker

## Arranque

Hacen falta tres cosas levantadas: la base de datos, la API y el frontend.

```bash
# 1. Base de datos
cp .env.example .env          # sólo la primera vez
docker compose up -d postgres

# 2. API  ->  http://localhost:3000
cd api
npm install                   # sólo la primera vez
npx prisma migrate dev        # sólo la primera vez
npm run dev

# 3. Frontend  ->  http://localhost:5173
cd react
npm install                   # sólo la primera vez
npm run dev
```

Adminer (cliente web de la BD, opcional) en <http://localhost:8081> con
`docker compose up -d` — servidor `postgres`, usuario y contraseña `bookhelper`.

## Después de reiniciar el ordenador

**Nada de esto vuelve solo**, salvo la base de datos y sólo a medias:

| Pieza | ¿Vuelve sola al encender? |
|---|---|
| Postgres (contenedor) | Sí, **pero sólo si Docker Desktop arranca**. Tiene `restart: unless-stopped`, y esa política sólo actúa dentro de Docker: sin Docker no hay contenedor |
| API (:3000) | **No.** Es `npm run dev` en una terminal, no un servicio de Windows |
| Frontend (:5173) | **No.** Igual |

Los datos **no se pierden nunca** al apagar: viven en `./postgres-data`, en
disco, no dentro del contenedor.

### Comprobar qué está levantado

```bash
curl -s http://localhost:3000/api/health          # API   -> {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173   # web -> 200
docker compose ps                                  # BD    -> Up (healthy)
```

### Volver a levantarlo todo

1. **Abre Docker Desktop** si no arrancó solo, y espera a que diga *Running*.
2. Luego, en dos terminales distintas:

```bash
docker compose up -d postgres     # espera a que salga "healthy"

cd api && npm run dev             # terminal 1 — dejar abierta
cd react && npm run dev           # terminal 2 — dejar abierta
```

No hace falta `npm install` ni `prisma migrate`: eso era sólo la primera vez.

Las terminales de la API y del frontend **se quedan ocupadas**: si las cierras,
matas el servidor. Abre <http://localhost:5173> cuando las dos estén en marcha.

**Si la IP de la máquina cambió** (pasa al reiniciar el router, es DHCP), hay
que actualizar `VITE_API_URL` en `react/.env` y **reiniciar Vite** — no recarga
el `.env` en caliente. Ver la sección siguiente.

## Acceso desde el móvil

El móvil tiene que estar en la misma Wi-Fi. Averigua la IP de la máquina
(`ipconfig` en Windows) y edita `react/.env`:

```
VITE_API_URL=http://192.168.1.157:3000
```

Tiene que ser la IP, **no `localhost`**: si no, el móvil intentará conectarse a
sí mismo. Reinicia Vite y abre `http://192.168.1.157:5173` en el teléfono.

Tanto la API como Vite ya escuchan en todas las interfaces, no hace falta
ninguna opción extra.

## Persistencia

Los datos viven en `./postgres-data` (bind mount) y las fotos en
`./uploads/characters`. Las dos carpetas están en `.gitignore`.

Sobreviven a `docker compose down`. Para **borrar la base de datos entera**:

```bash
docker compose down
rm -rf postgres-data/pgdata      # irreversible
```

### Copia de seguridad

```bash
docker exec book_helper_db pg_dump -U bookhelper book_helper > backup.sql
```

## Estructura

```
├── api/              backend Express + Prisma
├── react/            frontend web (Vite)
├── react-native/     app móvil — futuro, vacío
├── postgres-data/    volumen de la BD (gitignored)
└── uploads/          fotos de personajes (gitignored)
```
