# Book Helper

Aplicación para diseñar una novela antes de escribirla: trama, personajes y
capítulos. Pensada para un flujo en el que todo se planifica desde el principio.

El diseño completo está en [ARCHITECTURE.md](ARCHITECTURE.md).

## Estado

| Parte | Estado |
|---|---|
| Postgres + volumen persistente | ✅ funcionando |
| `api/` (Express + Prisma) | ✅ funcionando |
| `react/` — tabs Personajes, Capítulos y Trama | ✅ funcionando |
| `react-native/` | 🔮 futuro |

La tab de Personajes permite crear y editar personajes, subir y quitar su foto,
construir el arco como una línea de tiempo ordenable, y relacionarlos entre sí.

La tab de Capítulos es una lista ordenable de capítulos; cada uno tiene su
reparto (qué personajes salen y qué hacen) y su texto en **dos paneles**
lado a lado, cada uno con un rótulo editable ("Borrador"/"Reescritura" por
defecto), pensados para iterar sobre el mismo capítulo. El guardado es
explícito (botón o Ctrl+S), con aviso si intentas salir con cambios sin guardar.

La tab de Trama es una línea de tiempo de sucesos con **promesas**: cada
promesa se siembra en un suceso y, opcionalmente, se paga en otro. Un panel
aparte agrupa las promesas pendientes y las cumplidas.

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
