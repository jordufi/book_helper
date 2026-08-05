import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './schema';

const DB_NAME = 'book-helper.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre la base de datos y aplica las migraciones pendientes. Se memoriza la
 * promesa (no la conexión) para que varias llamadas concurrentes durante el
 * arranque compartan una única apertura en vez de abrir N conexiones.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((err) => {
      // Si falla, no dejar cacheada una promesa rechazada para siempre: el
      // siguiente intento debe poder volver a probar.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Las claves foráneas vienen DESACTIVADAS por defecto en SQLite. Sin esto,
  // los ON DELETE CASCADE / SET NULL del esquema no harían absolutamente nada
  // y borrar un libro dejaría personajes y capítulos huérfanos.
  // Va fuera de cualquier transacción a propósito: dentro se ignora en silencio.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  // WAL: lecturas concurrentes con una escritura, y menos fsync por commit.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  await migrate(db);
  return db;
}

/**
 * Migraciones por número de versión, con `PRAGMA user_version` como registro.
 * Para cambiar el esquema en el futuro: añadir una entrada nueva al final de
 * MIGRATIONS, nunca editar una ya publicada — los dispositivos que ya la
 * aplicaron no la volverán a ejecutar.
 */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    // Aquí basta la transacción normal (el resto del código usa
    // withExclusiveTransactionAsync): `getDb()` memoriza la promesa de
    // apertura, así que nadie recibe la conexión hasta que esto termina. No
    // hay ninguna otra consulta con la que competir.
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    // user_version no admite parámetros enlazados, y el valor es un entero
    // que sale de un índice de array, no de entrada del usuario.
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}

/** Sólo para desarrollo/pruebas: borra todo y vuelve a migrar desde cero. */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.closeAsync();
  await SQLite.deleteDatabaseAsync(DB_NAME);
  dbPromise = null;
  await getDb();
}
