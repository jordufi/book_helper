import { ApiError } from '../api/client';
import type {
  Book,
  Chapter,
  ChapterSummary,
  Character,
  CharacterSummary,
  Plot,
} from '../types';
import type { WorkspaceData } from './data';

/**
 * "Consultas" puras contra el documento en memoria: arman a mano los mismos
 * joins que hacía el `include`/`select` de Prisma en `api/src/routes/*.ts`.
 * Si estas formas no salen IDÉNTICAS a las de `src/types.ts`, los componentes
 * (que se copiaron sin tocar) se rompen en silencio o a medias.
 *
 * Reciben `data` como primer argumento en vez de leer un singleton: así son
 * funciones puras, fáciles de razonar, y `transfer.ts` puede probarlas sobre
 * una copia del documento sin tocar el estado real.
 */

const notFound = (what: string) => new ApiError(404, `${what} no encontrado`);

export function assertBookExists(data: WorkspaceData, bookId: string): void {
  if (!data.books.some((b) => b.id === bookId)) throw notFound('Libro');
}

export function listBooks(data: WorkspaceData): Book[] {
  return [...data.books]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((b) => ({
      ...b,
      _count: {
        characters: data.characters.filter((c) => c.bookId === b.id).length,
        chapters: data.chapters.filter((c) => c.bookId === b.id).length,
        plotEvents: data.plotEvents.filter((e) => e.bookId === b.id).length,
      },
    }));
}

export function listCharacters(data: WorkspaceData, bookId: string): CharacterSummary[] {
  assertBookExists(data, bookId);
  return data.characters
    .filter((c) => c.bookId === bookId)
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      age: c.age,
      arcSummary: c.arcSummary,
      updatedAt: c.updatedAt,
    }));
}

export function getCharacterOrThrow(data: WorkspaceData, id: string): Character {
  const c = data.characters.find((c) => c.id === id);
  if (!c) throw notFound('Personaje');

  const arcStages = data.arcStages
    .filter((s) => s.characterId === id)
    .sort((a, b) => a.position - b.position);

  const relationships = data.relationships
    .filter((r) => r.characterId === id)
    .map((r) => {
      const related = data.characters.find((c) => c.id === r.relatedCharacterId);
      // El personaje relacionado siempre debería existir (cascade al borrar),
      // pero por si acaso queda huérfano tras un import raro, se descarta en
      // vez de reventar la ficha entera.
      if (!related) return null;
      return {
        id: r.id,
        characterId: r.characterId,
        relatedCharacterId: r.relatedCharacterId,
        type: r.type,
        description: r.description,
        relatedCharacter: { id: related.id, name: related.name, role: related.role },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return { ...c, arcStages, relationships };
}

export function listChapters(data: WorkspaceData, bookId: string): ChapterSummary[] {
  assertBookExists(data, bookId);
  return data.chapters
    .filter((c) => c.bookId === bookId)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      bookId: c.bookId,
      position: c.position,
      title: c.title,
      synopsis: c.synopsis,
      updatedAt: c.updatedAt,
      _count: { cast: data.cast.filter((e) => e.chapterId === c.id).length },
    }));
}

export function getChapterOrThrow(data: WorkspaceData, id: string): Chapter {
  const ch = data.chapters.find((c) => c.id === id);
  if (!ch) throw notFound('Capítulo');

  const cast = data.cast
    .filter((e) => e.chapterId === id)
    .sort((a, b) => a.position - b.position)
    .map((e) => {
      const character = data.characters.find((c) => c.id === e.characterId);
      if (!character) return null;
      return {
        id: e.id,
        chapterId: e.chapterId,
        characterId: e.characterId,
        position: e.position,
        action: e.action,
        character: { id: character.id, name: character.name, role: character.role },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return { ...ch, cast };
}

export function getPlot(data: WorkspaceData, bookId: string): Plot {
  assertBookExists(data, bookId);

  const events = data.plotEvents
    .filter((e) => e.bookId === bookId)
    .sort((a, b) => a.position - b.position);

  const eventRef = (id: string) => {
    const e = events.find((e) => e.id === id) ?? data.plotEvents.find((e) => e.id === id);
    return e ? { id: e.id, position: e.position, title: e.title } : null;
  };

  const promises = data.plotPromises
    .filter((p) => p.bookId === bookId)
    .map((p) => ({
      id: p.id,
      bookId: p.bookId,
      title: p.title,
      description: p.description,
      setupEventId: p.setupEventId,
      setupEvent: eventRef(p.setupEventId)!,
      payoffEventId: p.payoffEventId,
      payoffEvent: p.payoffEventId ? eventRef(p.payoffEventId) : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
    .sort((a, b) => a.setupEvent.position - b.setupEvent.position || a.title.localeCompare(b.title));

  return { events, promises };
}
