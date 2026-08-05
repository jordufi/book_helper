import { getDb } from './database';
import { getBook } from './books';
import { newId, now, text } from './util';
import { bookImportSchema } from './transferSchema';
import type { Book } from '../types';

/**
 * Import/export de un libro completo en JSON. El formato es EXACTAMENTE el de
 * `GET /api/books/:id/export` de la web, para que un fichero exportado desde
 * el portátil se importe aquí (y al revés) sin conversiones.
 *
 * Sin fotos a propósito, igual que en la web: son ficheros en disco, no datos
 * portables dentro de un JSON.
 */

export async function exportBook(bookId: string): Promise<string> {
  const db = await getDb();
  const book = await getBook(bookId);
  if (!book) throw new Error('Libro no encontrado');

  const [characters, chapters, events, promises] = await Promise.all([
    db.getAllAsync<Record<string, string | null>>(
      'SELECT * FROM characters WHERE book_id = ? ORDER BY created_at ASC',
      bookId,
    ),
    db.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY position ASC',
      bookId,
    ),
    db.getAllAsync<Record<string, string | number | null>>(
      'SELECT * FROM plot_events WHERE book_id = ? ORDER BY position ASC',
      bookId,
    ),
    db.getAllAsync<Record<string, string | null>>(
      'SELECT * FROM plot_promises WHERE book_id = ?',
      bookId,
    ),
  ]);

  const arcStagesFor = async (characterId: string) =>
    db.getAllAsync<{ title: string; description: string | null }>(
      'SELECT title, description FROM character_arc_stages WHERE character_id = ? ORDER BY position ASC',
      characterId,
    );

  const relationshipsFor = async (characterId: string) =>
    db.getAllAsync<{ related_character_id: string; type: string; description: string | null }>(
      'SELECT related_character_id, type, description FROM character_relationships WHERE character_id = ?',
      characterId,
    );

  const castFor = async (chapterId: string) =>
    db.getAllAsync<{ character_id: string; action: string | null }>(
      'SELECT character_id, action FROM chapter_characters WHERE chapter_id = ? ORDER BY position ASC',
      chapterId,
    );

  const payload = {
    formatVersion: 1,
    exportedAt: now(),
    book: { title: book.title, author: book.author, synopsis: book.synopsis },
    characters: await Promise.all(
      characters.map(async (c) => ({
        id: c.id as string,
        name: c.name,
        role: c.role,
        age: c.age,
        physicalDescription: c.physical_description,
        personality: c.personality,
        backstory: c.backstory,
        personalPlot: c.personal_plot,
        arcSummary: c.arc_summary,
        notes: c.notes,
        arcStages: await arcStagesFor(c.id as string),
        relationships: (await relationshipsFor(c.id as string)).map((r) => ({
          relatedCharacterId: r.related_character_id,
          type: r.type,
          description: r.description,
        })),
      })),
    ),
    chapters: await Promise.all(
      chapters.map(async (ch) => ({
        id: ch.id as string,
        title: ch.title,
        synopsis: ch.synopsis,
        notes: ch.notes,
        textALabel: ch.text_a_label,
        textBLabel: ch.text_b_label,
        textA: ch.text_a,
        textB: ch.text_b,
        cast: (await castFor(ch.id as string)).map((e) => ({
          characterId: e.character_id,
          action: e.action,
        })),
      })),
    ),
    plot: {
      events: events.map((e) => ({ id: e.id, title: e.title, description: e.description })),
      promises: promises.map((p) => ({
        title: p.title,
        description: p.description,
        setupEventId: p.setup_event_id,
        payoffEventId: p.payoff_event_id,
      })),
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Crea un libro NUEVO a partir del JSON. Nunca sobrescribe uno existente ni
 * fusiona: reimportar el mismo fichero dos veces crea dos libros distintos.
 *
 * Todo va en una transacción, y en este orden porque cada paso necesita el
 * mapa de ids del anterior. Las relaciones se crean en una segunda pasada,
 * cuando ya existen todos los personajes: una relación puede apuntar a
 * cualquier personaje del libro, no sólo a los ya creados.
 */
export async function importBook(raw: unknown): Promise<Book> {
  const data = bookImportSchema.parse(raw);
  const db = await getDb();
  const bookId = newId();
  const ts = now();

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO books (id, title, author, synopsis, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      bookId,
      data.book.title,
      data.book.author,
      data.book.synopsis,
      ts,
      ts,
    );

    const characterIds = new Map<string, string>();
    for (const c of data.characters) {
      const id = newId();
      characterIds.set(c.id, id);
      await txn.runAsync(
        `INSERT INTO characters
          (id, book_id, name, role, age, photo_url, physical_description, personality,
           backstory, personal_plot, arc_summary, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        bookId,
        c.name,
        c.role,
        c.age,
        c.physicalDescription,
        c.personality,
        c.backstory,
        c.personalPlot,
        c.arcSummary,
        c.notes,
        ts,
        ts,
      );
    }

    for (const c of data.characters) {
      const characterId = characterIds.get(c.id)!;

      for (const [position, stage] of c.arcStages.entries()) {
        await txn.runAsync(
          `INSERT INTO character_arc_stages (id, character_id, position, title, description)
           VALUES (?, ?, ?, ?, ?)`,
          newId(),
          characterId,
          position,
          stage.title,
          stage.description,
        );
      }

      // Se deduplica antes de insertar en vez de atrapar el fallo del UNIQUE:
      // dentro de una transacción es más limpio no provocar el error siquiera.
      // Una referencia rota (un personaje que no está en el fichero) se
      // descarta en silencio: es un fichero externo, quizá editado a mano, y
      // perder una relación suelta es mejor que abortar todo el import.
      const seen = new Set<string>();
      for (const r of c.relationships) {
        const relatedId = characterIds.get(r.relatedCharacterId);
        if (!relatedId || relatedId === characterId) continue;
        const key = `${relatedId}:${r.type}`;
        if (seen.has(key)) continue;
        seen.add(key);

        await txn.runAsync(
          `INSERT INTO character_relationships
             (id, character_id, related_character_id, type, description)
           VALUES (?, ?, ?, ?, ?)`,
          newId(),
          characterId,
          relatedId,
          r.type,
          r.description,
        );
      }
    }

    const chapterIds = new Map<string, string>();
    for (const [position, ch] of data.chapters.entries()) {
      const id = newId();
      chapterIds.set(ch.id, id);
      await txn.runAsync(
        `INSERT INTO chapters
          (id, book_id, position, title, synopsis, notes,
           text_a_label, text_b_label, text_a, text_b, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        bookId,
        position,
        ch.title,
        ch.synopsis,
        ch.notes,
        ch.textALabel,
        ch.textBLabel,
        ch.textA,
        ch.textB,
        ts,
        ts,
      );

      const seenCast = new Set<string>();
      let castPosition = 0;
      for (const entry of ch.cast) {
        const characterId = characterIds.get(entry.characterId);
        if (!characterId || seenCast.has(characterId)) continue;
        seenCast.add(characterId);

        await txn.runAsync(
          `INSERT INTO chapter_characters (id, chapter_id, character_id, position, action)
           VALUES (?, ?, ?, ?, ?)`,
          newId(),
          id,
          characterId,
          castPosition++,
          entry.action,
        );
      }
    }

    const eventIds = new Map<string, string>();
    for (const [position, e] of data.plot.events.entries()) {
      const id = newId();
      eventIds.set(e.id, id);
      await txn.runAsync(
        `INSERT INTO plot_events (id, book_id, position, title, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        bookId,
        position,
        e.title,
        e.description,
        ts,
        ts,
      );
    }

    for (const p of data.plot.promises) {
      const setupEventId = eventIds.get(p.setupEventId);
      // Sin siembra válida la promesa no significa nada (mismo criterio que el
      // CASCADE de setup_event_id): se descarta.
      if (!setupEventId) continue;
      const payoffEventId = p.payoffEventId ? (eventIds.get(p.payoffEventId) ?? null) : null;

      await txn.runAsync(
        `INSERT INTO plot_promises
           (id, book_id, title, description, setup_event_id, payoff_event_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        bookId,
        p.title,
        text(p.description),
        setupEventId,
        payoffEventId,
        ts,
        ts,
      );
    }
  });

  return (await getBook(bookId))!;
}
