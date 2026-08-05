import { getDb } from './database';
import { newId, now, text } from './util';
import type { Book } from '../types';

interface BookRow {
  id: string;
  title: string;
  author: string | null;
  synopsis: string | null;
  created_at: string;
  updated_at: string;
  characters: number;
  chapters: number;
  plot_events: number;
}

const toBook = (r: BookRow): Book => ({
  id: r.id,
  title: r.title,
  author: r.author,
  synopsis: r.synopsis,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  _count: { characters: r.characters, chapters: r.chapters, plotEvents: r.plot_events },
});

/** Subconsultas en vez de tres JOIN + GROUP BY: con LEFT JOIN los contadores
 *  se multiplican entre sí (2 personajes × 3 capítulos = 6 y 6). */
const SELECT_BOOKS = `
  SELECT b.*,
    (SELECT COUNT(*) FROM characters  c WHERE c.book_id = b.id) AS characters,
    (SELECT COUNT(*) FROM chapters    ch WHERE ch.book_id = b.id) AS chapters,
    (SELECT COUNT(*) FROM plot_events e WHERE e.book_id = b.id) AS plot_events
  FROM books b
`;

export async function listBooks(): Promise<Book[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BookRow>(`${SELECT_BOOKS} ORDER BY b.updated_at DESC`);
  return rows.map(toBook);
}

export async function getBook(id: string): Promise<Book | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BookRow>(`${SELECT_BOOKS} WHERE b.id = ?`, id);
  return row ? toBook(row) : null;
}

export async function createBook(input: {
  title: string;
  author?: string | null;
  synopsis?: string | null;
}): Promise<Book> {
  const db = await getDb();
  const id = newId();
  const ts = now();

  await db.runAsync(
    `INSERT INTO books (id, title, author, synopsis, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    input.title.trim(),
    text(input.author),
    text(input.synopsis),
    ts,
    ts,
  );

  return (await getBook(id))!;
}

export async function updateBook(
  id: string,
  patch: { title?: string; author?: string | null; synopsis?: string | null },
): Promise<Book> {
  const db = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) {
    sets.push('title = ?');
    values.push(patch.title.trim());
  }
  if (patch.author !== undefined) {
    sets.push('author = ?');
    values.push(text(patch.author));
  }
  if (patch.synopsis !== undefined) {
    sets.push('synopsis = ?');
    values.push(text(patch.synopsis));
  }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(now(), id);
    await db.runAsync(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`, ...(values as never[]));
  }

  const book = await getBook(id);
  if (!book) throw new Error('Libro no encontrado');
  return book;
}

/**
 * Borra el libro. Personajes, capítulos y trama se van por las claves foráneas
 * ON DELETE CASCADE — siempre que `PRAGMA foreign_keys = ON` esté puesto, que
 * es justo lo que hace `database.ts` al abrir.
 */
export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM books WHERE id = ?', id);
}

/** Marca el libro como tocado: lo sube en la lista, ordenada por updated_at. */
export async function touchBook(bookId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE books SET updated_at = ? WHERE id = ?', now(), bookId);
}
