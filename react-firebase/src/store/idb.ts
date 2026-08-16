/**
 * Envoltorio mínimo sobre IndexedDB, sin dependencias. Guarda el workspace
 * entero bajo una única clave: no hace falta más granularidad porque siempre
 * se lee/escribe el documento completo (igual que el JSON que se descarga).
 *
 * IndexedDB y no localStorage: `textA`/`textB` admiten 200.000 caracteres cada
 * uno (ver CLAUDE.md de `api/`), así que con dos o tres libros con capítulos
 * escritos se pasa de sobra el límite de ~5 MB de localStorage y `setItem`
 * lanza `QuotaExceededError`.
 */

const DB_NAME = 'book-helper';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const KEY = 'data';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbLoad(): Promise<unknown | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function idbSave(data: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
