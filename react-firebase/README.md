# Book Helper — versión sin servidor (Firebase)

Es la misma app de diseño de novelas que `../react/`, pero sin `api/` ni
Postgres detrás: todo vive en el navegador. Pensada para publicarse en
Firebase Hosting con un dominio propio, sin coste, sin usuarios concurrentes
y sin cuenta ni login.

## Cómo funciona sin servidor

No hay backend: los datos se guardan en **IndexedDB**, dentro del propio
navegador, y se actualizan solos mientras trabajas (autoguardado con un
pequeño retraso tras cada cambio). Si cierras la pestaña o recargas, todo
sigue ahí.

Pero IndexedDB es *de este navegador, en este ordenador*. Para llevarte un
libro a otro sitio, o para tener una copia de verdad fuera del navegador:

- **"Descargar libro (JSON)"** (en Gestionar libros) descarga un fichero con
  el libro completo: personajes, capítulos con su texto, trama. Guárdalo
  donde quieras — es tu copia de seguridad.
- **"Abrir libro (JSON)"** carga uno de esos ficheros como un libro **nuevo**
  en este navegador (nunca sobrescribe uno que ya tengas aquí).

Un libro con la etiqueta **"sin descargar"** tiene cambios que sólo existen
en este navegador — si borras los datos del navegador, o cambias de
ordenador, se pierden. Descárgalo antes.

**El fichero JSON es el mismo formato** que usan `../react/` (con Postgres) y
la app Android (`../react-native/`): puedes mover un libro entre las tres sin
conversión.

**Esta versión no lleva fotos de personaje** (a diferencia de `../react/`):
sin servidor no hay dónde guardar el fichero de la imagen. Los personajes se
muestran con la inicial de su nombre.

## Arranque local

```bash
npm install
npm run dev          # http://localhost:5173
```

No hace falta `.env`, ni Docker, ni la API: todo corre en el navegador.

```bash
npm run typecheck    # tsc --noEmit
npm run build         # tsc -b && vite build -> dist/
npm run preview       # sirve dist/ localmente, para probar el build real
```

## Desplegar en Firebase Hosting

Primera vez:

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # elige o crea el proyecto; sustituye "book-helper" en .firebaserc
```

Cada despliegue:

```bash
firebase deploy --only hosting
```

`firebase.json` ya hace `npm run build` por ti (`predeploy`) y sirve `dist/`.
El router de la app es de hash (`#/personajes`, `#/trama`…), así que en la
práctica sólo se pide `/`; el `rewrite` a `index.html` está por si alguien
teclea una ruta a mano.

**Trampa:** el `predeploy` es sólo `npm run build`, sin `--prefix
"$RESOURCE_DIR"`. Esa variable, en un hook de Hosting, apunta al directorio
`public` (`dist/`) — no a la raíz del proyecto — así que con `--prefix`
intenta correr `npm run build` dentro de `dist/`, que ni existe antes del
build ni tiene `package.json`. El comando ya corre con la raíz de
`react-firebase/` como cwd (donde vive `firebase.json`), así que no hace
falta indicar ningún directorio.

El plan gratuito (Spark) de Firebase cubre de sobra este uso: es hosting
estático sin base de datos.

## Dominio propio

En la consola de Firebase: **Hosting → Añadir dominio personalizado**, y
sigue las instrucciones para añadir los registros DNS (normalmente A y TXT)
en el panel de tu registrador. El certificado HTTPS lo emite Firebase solo;
puede tardar hasta 24 h en propagarse.

## Qué es distinto de `../react/`

Ver la sección "Web pública (`react-firebase/`)" en el
[`CLAUDE.md`](../CLAUDE.md) de la raíz para el porqué de cada decisión
(IndexedDB en vez de localStorage, por qué se mantiene react-query sin red,
por qué no hay fotos, etc.). Resumen rápido:

| | `react/` | `react-firebase/` |
|---|---|---|
| Datos | Postgres vía `api/` | IndexedDB, en el navegador |
| Multi-dispositivo | Sí, mismo servidor | No: cada navegador tiene lo suyo |
| Fotos de personaje | Sí | No |
| Llevarse un libro a otro sitio | Exportar/Importar JSON | Descargar/Abrir el mismo JSON |
| Coste | Un servidor siempre encendido | Gratis (Firebase Hosting, plan Spark) |
