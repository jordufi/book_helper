# Book Helper — móvil (Android / iOS)

La misma app de diseñar novelas, pero **sin servidor**: los datos viven en una
SQLite dentro del propio teléfono. No hay API, ni Postgres, ni red. Se puede
usar en un avión.

Es una app de Expo (SDK 57) escrita en TypeScript.

## Diferencia con `react/`

| | `react/` (web) | `react-native/` (móvil) |
|---|---|---|
| Datos | Postgres, vía la API de `api/` | SQLite local, `expo-sqlite` |
| Red | Necesaria (la API en la Wi-Fi) | **Ninguna** |
| Fotos de personajes | Sí | Todavía no |
| Vista "Libro" (resumen) y export a Markdown | Sí | Todavía no |

Lo demás está: libros, personajes (con arco y relaciones), capítulos (con
reparto y los dos paneles de texto) y trama (sucesos y promesas).

## Arranque en desarrollo

```bash
cd react-native
npm install
npx expo start        # abre Expo Go en el móvil y escanea el QR
```

Expo Go vale para trastear, pero **no** para la versión definitiva: la app usa
módulos nativos (`expo-sqlite`, `expo-crypto`). Para probarla de verdad hay que
generar una build de desarrollo o directamente el APK.

## Generar el APK (y iOS)

### Opción A — EAS Build (en la nube, sin instalar nada)

No hace falta Android SDK ni un Mac. Necesita una cuenta gratuita de Expo.

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android   # -> APK descargable
eas build --profile preview --platform ios       # -> build de simulador
```

El perfil `preview` está configurado en `eas.json` para producir **APK** y no
`.aab`: el `.aab` no se instala directamente en el teléfono.

Para un iOS instalable en un iPhone real hace falta cuenta de Apple Developer
(99 $/año); eso es de Apple, no de esta app.

### Opción B — compilar en local (sin servicios externos)

Requiere JDK 17+ y Android Studio con el SDK (unos 10 GB).

```bash
npx expo prebuild          # genera android/ e ios/
npx expo run:android       # compila e instala en el dispositivo conectado
```

`android/` e `ios/` están en `.gitignore` a propósito: son artefactos
regenerables, no fuente.

Para iOS en local hace falta un Mac con Xcode. No hay forma de evitarlo.

## Llevarse los libros de la web al móvil

El formato JSON es **el mismo** en las dos apps:

1. En la web: *Gestionar libros* → **Exportar JSON**.
2. Pasa el `.json` al teléfono (correo, Drive, cable…).
3. En el móvil: pestaña *Libros* → **Importar JSON**.

Y al revés: el botón **Exportar** de cada libro abre la hoja de compartir del
sistema con el `.json` generado.

Importar siempre crea un libro **nuevo**; nunca sobrescribe ni fusiona. Las
fotos no viajan en el JSON (en ninguna de las dos apps).

## Estructura

```
src/
├── db/            SQLite: esquema, migraciones y consultas
│   ├── schema.ts        DDL (traducción del schema de Prisma)
│   ├── database.ts      apertura, PRAGMA y migraciones por user_version
│   ├── books.ts characters.ts chapters.ts plot.ts
│   ├── transferSchema.ts  validación zod del JSON (sin Expo: testeable aparte)
│   └── transfer.ts        export/import contra la BD
├── data/hooks.ts  react-query sobre lo anterior (mismas claves que la web)
├── state/         libro activo, persistido con expo-sqlite/kv-store
├── ui/            tema (misma paleta que la web) y componentes
├── screens/       una pantalla por pestaña, más las fichas
└── navigation.ts  listas de parámetros de los stacks
```

## Detalles que parecen errores y no lo son

- **`PRAGMA foreign_keys = ON` al abrir la BD.** SQLite trae las claves
  foráneas **desactivadas** por defecto; sin esa línea los `ON DELETE CASCADE`
  del esquema no harían nada y borrar un libro dejaría todo huérfano.
- **`role` es TEXT con CHECK, no un enum**, porque SQLite no tiene enums. Por
  eso la lista de personajes ordena con un `CASE`: alfabéticamente saldría
  ANTAGONIST antes que PROTAGONIST, que no es el orden de la web.
- **Sin `UNIQUE(book_id, position)`**, igual que en Postgres: reordenar en
  transacción pasa por estados con posiciones repetidas.
- **`payoff_event_id` es SET NULL y `setup_event_id` es CASCADE.** Borrar el
  suceso donde se paga una promesa la devuelve a "pendiente"; borrar el de la
  siembra la borra con él.
- **El update de capítulo sólo toca las claves presentes en el patch.** Si
  escribiera todas las columnas, guardar el panel A vaciaría el B.
- **Las transacciones son `withExclusiveTransactionAsync`, no
  `withTransactionAsync`.** La segunda **no aísla** (lo dice la documentación
  de expo-sqlite): otras consultas se cuelan en medio, y entonces el
  `MAX(position)` + `INSERT` del alta puede dar dos capítulos con la misma
  posición. Dentro de la transacción hay que usar `txn.*`, nunca `db.*`, o se
  queda esperando a sí misma.
- **El libro activo va en un Context.** Las pestañas se quedan montadas, así
  que un `useState` por pantalla haría que cambiar de libro no llegase a las
  demás.
- **El aviso de "cambios sin guardar" es `usePreventRemove`**, no un indicador
  en la cabecera como en la web. Cubre atrás, el gesto y el atrás de Android;
  no cubre cambiar de pestaña, porque ahí la pantalla no se desmonta y el
  borrador sigue intacto.
- **`ScreenScroll` usa `automaticallyAdjustKeyboardInsets` y no
  `KeyboardAvoidingView`**: éste necesitaría la altura de la cabecera, que vive
  en un paquete que aquí sólo es dependencia transitiva. Dentro del `Sheet` sí
  se usa `KeyboardAvoidingView`, porque en un modal no hay cabecera.
