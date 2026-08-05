import { getDb } from './database';
import { touchBook } from './books';
import { newId, now, text } from './util';
import type { Chapter, ChapterPatch, ChapterSummary, CharacterRole } from '../types';

interface ChapterRow {
  id: string;
  book_id: string;
  position: number;
  title: string;
  synopsis: string | null;
  notes: string | null;
  text_a_label: string;
  text_b_label: string;
  text_a: string | null;
  text_b: string | null;
  created_at: string;
  updated_at: string;
}

interface CastRow {
  id: string;
  chapter_id: string;
  character_id: string;
  position: number;
  action: string | null;
  name: string;
  photo_url: string | null;
  role: CharacterRole;
}

/** La lista NO trae text_a/text_b: un capítulo entero puede pesar cientos de KB. */
export async function listChapters(bookId: string): Promise<ChapterSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    book_id: string;
    position: number;
    title: string;
    synopsis: string | null;
    updated_at: string;
    cast_count: number;
  }>(
    `SELECT c.id, c.book_id, c.position, c.title, c.synopsis, c.updated_at,
            (SELECT COUNT(*) FROM chapter_characters cc WHERE cc.chapter_id = c.id) AS cast_count
     FROM chapters c
     WHERE c.book_id = ?
     ORDER BY c.position ASC`,
    bookId,
  );

  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    position: r.position,
    title: r.title,
    synopsis: r.synopsis,
    updatedAt: r.updated_at,
    _count: { cast: r.cast_count },
  }));
}

export async function getChapter(id: string): Promise<Chapter | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ChapterRow>('SELECT * FROM chapters WHERE id = ?', id);
  if (!row) return null;

  const cast = await db.getAllAsync<CastRow>(
    `SELECT cc.*, c.name, c.photo_url, c.role
     FROM chapter_characters cc
     JOIN characters c ON c.id = cc.character_id
     WHERE cc.chapter_id = ?
     ORDER BY cc.position ASC`,
    id,
  );

  return {
    id: row.id,
    bookId: row.book_id,
    position: row.position,
    title: row.title,
    synopsis: row.synopsis,
    notes: row.notes,
    textALabel: row.text_a_label,
    textBLabel: row.text_b_label,
    textA: row.text_a,
    textB: row.text_b,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cast: cast.map((c) => ({
      id: c.id,
      chapterId: c.chapter_id,
      characterId: c.character_id,
      position: c.position,
      action: c.action,
      character: { id: c.character_id, name: c.name, photoUrl: c.photo_url, role: c.role },
    })),
  };
}

/**
 * El texto NO va en el alta: un capítulo nace vacío.
 *
 * Leer `MAX(position)` y luego insertar tiene que ser ATÓMICO, y para eso hace
 * falta `withExclusiveTransactionAsync`, no `withTransactionAsync`: esta
 * última no aísla —la propia documentación de expo-sqlite avisa de que otras
 * consultas async pueden colarse en medio—, así que dos altas simultáneas
 * leerían el mismo máximo y crearían dos capítulos con la MISMA posición. Como
 * no hay UNIQUE(book_id, position) que lo frene, `ORDER BY position` pasaría a
 * dar un orden no determinista y la lista se reordenaría sola.
 *
 * Dentro hay que usar `txn`, NUNCA `db`: `db` va por fuera de la transacción y
 * se quedaría esperando a que ésta termine.
 *
 * Se usa MAX y no COUNT porque los borrados dejan huecos en la numeración.
 */
export async function createChapter(
  bookId: string,
  input: { title: string; synopsis?: string | null; notes?: string | null },
): Promise<Chapter> {
  const db = await getDb();
  const id = newId();
  const ts = now();

  await db.withExclusiveTransactionAsync(async (txn) => {
    const max = await txn.getFirstAsync<{ max_position: number | null }>(
      'SELECT MAX(position) AS max_position FROM chapters WHERE book_id = ?',
      bookId,
    );
    const position = (max?.max_position ?? -1) + 1;

    await txn.runAsync(
      `INSERT INTO chapters
        (id, book_id, position, title, synopsis, notes,
         text_a_label, text_b_label, text_a, text_b, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Borrador', 'Reescritura', NULL, NULL, ?, ?)`,
      id,
      bookId,
      position,
      input.title.trim(),
      text(input.synopsis),
      text(input.notes),
      ts,
      ts,
    );
  });

  await touchBook(bookId);
  return (await getChapter(id))!;
}

/**
 * Update parcial: SÓLO se tocan las claves realmente presentes en el patch.
 *
 * Es la misma protección que `longTextPatch` en la API y por el mismo motivo:
 * si se escribieran todas las columnas, guardar el panel A vaciaría el B. Una
 * clave ausente significa "no tocar"; `null` o cadena vacía significan
 * "vaciar", que es una petición explícita.
 */
export async function updateChapter(id: string, patch: ChapterPatch): Promise<Chapter> {
  const db = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  const push = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.title !== undefined) push('title', patch.title.trim());
  if (patch.synopsis !== undefined) push('synopsis', text(patch.synopsis));
  if (patch.notes !== undefined) push('notes', text(patch.notes));
  // Los rótulos son NOT NULL: se cambian, no se vacían.
  if (patch.textALabel !== undefined && patch.textALabel.trim()) {
    push('text_a_label', patch.textALabel.trim());
  }
  if (patch.textBLabel !== undefined && patch.textBLabel.trim()) {
    push('text_b_label', patch.textBLabel.trim());
  }
  if (patch.textA !== undefined) push('text_a', text(patch.textA));
  if (patch.textB !== undefined) push('text_b', text(patch.textB));

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(now(), id);
    await db.runAsync(`UPDATE chapters SET ${sets.join(', ')} WHERE id = ?`, ...(values as never[]));
  }

  const chapter = await getChapter(id);
  if (!chapter) throw new Error('Capítulo no encontrado');
  await touchBook(chapter.bookId);
  return chapter;
}

export async function deleteChapter(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM chapters WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM chapters WHERE id = ?', id);
  if (row) await touchBook(row.book_id);
}

/**
 * Reordena la lista entera. Exige el conjunto EXACTO de capítulos del libro:
 * una lista obsoleta reordenaría en silencio con datos incompletos.
 */
export async function reorderChapters(bookId: string, ids: string[]): Promise<ChapterSummary[]> {
  const db = await getDb();
  const current = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM chapters WHERE book_id = ?',
    bookId,
  );
  const currentIds = new Set(current.map((c) => c.id));

  if (
    ids.length !== currentIds.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !currentIds.has(id))
  ) {
    throw new Error('La lista de orden debe contener exactamente los capítulos del libro');
  }

  // Exclusiva: a mitad del bucle hay posiciones repetidas, y una lectura que
  // se colara ahí vería la lista en un orden que no existe.
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [position, id] of ids.entries()) {
      await txn.runAsync('UPDATE chapters SET position = ? WHERE id = ?', position, id);
    }
  });

  await touchBook(bookId);
  return listChapters(bookId);
}

/**
 * Reemplaza el reparto entero (como el arco): son pocas filas y la pantalla ya
 * tiene el borrador completo. `position` sale del índice del array.
 */
export async function saveCast(
  chapterId: string,
  cast: { characterId: string; action: string | null }[],
): Promise<Chapter> {
  const db = await getDb();

  const chapter = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM chapters WHERE id = ?',
    chapterId,
  );
  if (!chapter) throw new Error('Capítulo no encontrado');

  const ids = cast.map((c) => c.characterId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Un personaje no puede aparecer dos veces en el mismo capítulo');
  }

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ');
    const found = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM characters WHERE book_id = ? AND id IN (${placeholders})`,
      chapter.book_id,
      ...ids,
    );
    if (found.length !== ids.length) {
      throw new Error('Los personajes deben pertenecer al libro del capítulo');
    }
  }

  // Exclusiva: entre el DELETE y los INSERT el reparto está vacío, y una
  // lectura que se colara ahí lo mostraría sin nadie.
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM chapter_characters WHERE chapter_id = ?', chapterId);
    for (const [position, entry] of cast.entries()) {
      await txn.runAsync(
        `INSERT INTO chapter_characters (id, chapter_id, character_id, position, action)
         VALUES (?, ?, ?, ?, ?)`,
        newId(),
        chapterId,
        entry.characterId,
        position,
        text(entry.action),
      );
    }
    await txn.runAsync('UPDATE chapters SET updated_at = ? WHERE id = ?', now(), chapterId);
  });

  await touchBook(chapter.book_id);
  return (await getChapter(chapterId))!;
}
