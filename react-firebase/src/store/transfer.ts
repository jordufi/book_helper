import { ZodError } from 'zod';
import { ApiError } from '../api/client';
import type { Book } from '../types';
import type {
  DbArcStage,
  DbCastEntry,
  DbCharacter,
  DbChapter,
  DbPlotEvent,
  DbPromise,
  DbRelationship,
  WorkspaceData,
} from './data';
import { getData, replaceData } from './store';
import { newId } from './ids';
import * as select from './select';
import { bookImportSchema } from './transferSchema';

/**
 * Calca `api/src/routes/books.ts` (`GET /:id/export`, `POST /import`). El
 * formato es el mismo (`formatVersion: 1`) para que un fichero se mueva sin
 * conversión entre esta app, la web con Postgres y la app Android — el puente
 * entre las tres es el JSON, no el código (ver CLAUDE.md).
 */

// --- Export --------------------------------------------------------------------

export function exportBook(bookId: string): unknown {
  const data = getData();
  select.assertBookExists(data, bookId);
  const book = data.books.find((b) => b.id === bookId)!;

  const characters = data.characters
    .filter((c) => c.bookId === bookId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const chapters = [...data.chapters.filter((c) => c.bookId === bookId)].sort((a, b) => a.position - b.position);
  const events = [...data.plotEvents.filter((e) => e.bookId === bookId)].sort((a, b) => a.position - b.position);
  const promises = data.plotPromises.filter((p) => p.bookId === bookId);

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    book: { title: book.title, author: book.author, synopsis: book.synopsis },
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      age: c.age,
      physicalDescription: c.physicalDescription,
      personality: c.personality,
      backstory: c.backstory,
      personalPlot: c.personalPlot,
      arcSummary: c.arcSummary,
      notes: c.notes,
      arcStages: data.arcStages
        .filter((s) => s.characterId === c.id)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ title: s.title, description: s.description })),
      relationships: data.relationships
        .filter((r) => r.characterId === c.id)
        .map((r) => ({
          relatedCharacterId: r.relatedCharacterId,
          type: r.type,
          description: r.description,
        })),
    })),
    chapters: chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      synopsis: ch.synopsis,
      notes: ch.notes,
      textALabel: ch.textALabel,
      textBLabel: ch.textBLabel,
      textA: ch.textA,
      textB: ch.textB,
      cast: data.cast
        .filter((e) => e.chapterId === ch.id)
        .sort((a, b) => a.position - b.position)
        .map((e) => ({ characterId: e.characterId, action: e.action })),
    })),
    plot: {
      events: events.map((e) => ({ id: e.id, title: e.title, description: e.description })),
      promises: promises.map((p) => ({
        title: p.title,
        description: p.description,
        setupEventId: p.setupEventId,
        payoffEventId: p.payoffEventId,
      })),
    },
  };
}

// --- Import ----------------------------------------------------------------

/**
 * Crea un libro NUEVO a partir de un JSON exportado por esta misma función
 * (o por la API, o por la app Android). Siempre aditivo: nunca sobrescribe un
 * libro existente. Todo se inserta con ids nuevos, remapeando en memoria las
 * referencias del propio fichero — el fichero conserva sus ids sólo para que
 * relaciones/reparto/promesas puedan referenciarse entre sí *dentro de él*.
 *
 * Se construye sobre una COPIA del documento y sólo se confirma al final con
 * `replaceData`: es el equivalente a la transacción de la API ahora que no
 * hay `prisma.$transaction` — si algo lanzara a mitad, el documento real no
 * habría cambiado.
 */
export function importBook(rawPayload: unknown): Book {
  let parsed;
  try {
    parsed = bookImportSchema.parse(rawPayload);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(
        400,
        'El fichero no tiene el formato esperado',
        err.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })),
      );
    }
    throw err;
  }

  const current = getData();
  const next: WorkspaceData = {
    ...current,
    books: [...current.books],
    characters: [...current.characters],
    arcStages: [...current.arcStages],
    relationships: [...current.relationships],
    chapters: [...current.chapters],
    cast: [...current.cast],
    plotEvents: [...current.plotEvents],
    plotPromises: [...current.plotPromises],
  };

  const timestamp = new Date().toISOString();
  const bookId = newId();
  next.books.push({
    id: bookId,
    title: parsed.book.title,
    author: parsed.book.author,
    synopsis: parsed.book.synopsis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Personajes primero, sin arco ni relaciones: hacen falta todos los ids
  // nuevos antes de poder remapear las relaciones (que pueden apuntar a
  // cualquier otro personaje del fichero, no sólo a los ya creados).
  const characterIdMap = new Map<string, string>();
  for (const c of parsed.characters) {
    const newCharacterId = newId();
    characterIdMap.set(c.id, newCharacterId);
    const character: DbCharacter = {
      id: newCharacterId,
      bookId,
      name: c.name,
      role: c.role,
      age: c.age,
      physicalDescription: c.physicalDescription,
      personality: c.personality,
      backstory: c.backstory,
      personalPlot: c.personalPlot,
      arcSummary: c.arcSummary,
      notes: c.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    next.characters.push(character);
  }

  for (const c of parsed.characters) {
    const newCharacterId = characterIdMap.get(c.id)!;

    c.arcStages.forEach((s, position) => {
      const stage: DbArcStage = {
        id: newId(),
        characterId: newCharacterId,
        position,
        title: s.title,
        description: s.description,
      };
      next.arcStages.push(stage);
    });

    // Sin dedupe, dos relaciones iguales en el fichero violarían el
    // @@unique([characterId, relatedCharacterId, type]) que sí se respeta al
    // crear relaciones a mano (`addRelationship`); aquí no hay transacción que
    // aborte sola, así que se filtra en memoria antes de insertar.
    const seen = new Set<string>();
    for (const r of c.relationships) {
      const newRelatedId = characterIdMap.get(r.relatedCharacterId);
      if (!newRelatedId || newRelatedId === newCharacterId) continue;
      const key = `${newRelatedId}:${r.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const relationship: DbRelationship = {
        id: newId(),
        characterId: newCharacterId,
        relatedCharacterId: newRelatedId,
        type: r.type,
        description: r.description,
      };
      next.relationships.push(relationship);
    }
  }

  const chapterIdMap = new Map<string, string>();
  parsed.chapters.forEach((ch, position) => {
    const newChapterId = newId();
    chapterIdMap.set(ch.id, newChapterId);
    const chapter: DbChapter = {
      id: newChapterId,
      bookId,
      position,
      title: ch.title,
      synopsis: ch.synopsis,
      notes: ch.notes,
      textALabel: ch.textALabel,
      textBLabel: ch.textBLabel,
      textA: ch.textA,
      textB: ch.textB,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    next.chapters.push(chapter);
  });

  for (const ch of parsed.chapters) {
    const newChapterId = chapterIdMap.get(ch.id)!;
    const seen = new Set<string>();
    let position = 0;
    for (const entry of ch.cast) {
      const newCharacterId = characterIdMap.get(entry.characterId);
      if (!newCharacterId || seen.has(newCharacterId)) continue;
      seen.add(newCharacterId);
      const cast: DbCastEntry = {
        id: newId(),
        chapterId: newChapterId,
        characterId: newCharacterId,
        position: position++,
        action: entry.action,
      };
      next.cast.push(cast);
    }
  }

  // Sucesos antes que promesas: una promesa siempre necesita el id nuevo de
  // su suceso-siembra.
  const eventIdMap = new Map<string, string>();
  parsed.plot.events.forEach((e, position) => {
    const newEventId = newId();
    eventIdMap.set(e.id, newEventId);
    const event: DbPlotEvent = {
      id: newEventId,
      bookId,
      position,
      title: e.title,
      description: e.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    next.plotEvents.push(event);
  });

  for (const p of parsed.plot.promises) {
    const newSetupId = eventIdMap.get(p.setupEventId);
    // Sin siembra válida la promesa no significa nada (igual que CASCADE en
    // setup_event_id): se descarta en vez de romper el import entero.
    if (!newSetupId) continue;
    const promise: DbPromise = {
      id: newId(),
      bookId,
      title: p.title,
      description: p.description,
      setupEventId: newSetupId,
      payoffEventId: p.payoffEventId ? (eventIdMap.get(p.payoffEventId) ?? null) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    next.plotPromises.push(promise);
  }

  replaceData(next);
  return select.listBooks(next).find((b) => b.id === bookId)!;
}
