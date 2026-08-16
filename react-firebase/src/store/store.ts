import { ZodError, type ZodType } from 'zod';
import { ApiError } from '../api/client';
import type { Book, Chapter, ChapterSummary, Character, Plot } from '../types';
import {
  emptyWorkspace,
  isWorkspaceData,
  type DbBook,
  type DbChapter,
  type DbCharacter,
  type DbPlotEvent,
  type DbPromise,
  type WorkspaceData,
} from './data';
import { idbLoad, idbSave } from './idb';
import { newId } from './ids';
import * as schemas from './schemas';
import * as select from './select';

/**
 * El "backend" en memoria. Módulo singleton (no un Context de React) a
 * propósito: es exactamente lo que `api/hooks.ts` esperaba llamar en vez de
 * `fetch`, y así los tres helpers privados de `hooks.ts`
 * (`useCharacterMutation`, `useChapterMutation`, `usePlotMutation`) siguen
 * siendo correctos sin tocarlos — cada función de aquí devuelve el agregado
 * completo recargado, igual que hacía la API.
 *
 * Sin locks ni transacciones: JS es monohilo y hay un único usuario, así que
 * la carrera que `lockBookOrThrow` resolvía en la API (dos altas a la vez
 * calculando la misma `position`) no puede darse aquí. La única operación que
 * sí necesita "todo o nada" es el import completo de un libro, y ésa se
 * resuelve en `transfer.ts` construyendo sobre una copia y sustituyendo el
 * documento entero al final (`replaceData`).
 */

let data: WorkspaceData = emptyWorkspace();

const now = () => new Date().toISOString();
const notFound = (what: string) => new ApiError(404, `${what} no encontrado`);

/** Traduce un fallo de zod al mismo `{error, details}` que pintaba la API. */
function parse<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(
        400,
        'Datos inválidos',
        err.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })),
      );
    }
    throw err;
  }
}

function validateOrderIds(currentIds: string[], ids: string[], what: string): void {
  const currentSet = new Set(currentIds);
  const uniqueIds = new Set(ids);
  if (ids.length !== currentSet.size || uniqueIds.size !== ids.length || ids.some((id) => !currentSet.has(id))) {
    throw new ApiError(400, `La lista de orden debe contener exactamente los ${what} del libro`);
  }
}

// --- Persistencia ------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce de 300 ms: escribir en cada tecla sería un IndexedDB por letra. */
function scheduleSave(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void idbSave(data);
  }, 300);
}

function flushSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void idbSave(data);
}

if (typeof document !== 'undefined') {
  // Si se cierra la pestaña con el debounce a medias, que no se pierda.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}

export async function initStore(): Promise<void> {
  try {
    const loaded = await idbLoad();
    data = isWorkspaceData(loaded) ? loaded : emptyWorkspace();
  } catch {
    // IndexedDB no disponible (incógnito estricto) o corrupta: arrancar en
    // memoria es mejor que dejar la app sin cargar.
    data = emptyWorkspace();
  }
}

/** Lectura del documento completo. Las "consultas" viven en `select.ts`. */
export function getData(): WorkspaceData {
  return data;
}

/** Sustituye el documento entero de golpe. Sólo lo usa `transfer.ts` al
 * importar: construye la copia, y aquí se confirma en un único paso. */
export function replaceData(next: WorkspaceData): void {
  data = next;
  notifyUndownloaded();
  scheduleSave();
}

// --- "Sin descargar" -----------------------------------------------------------

const undownloadedListeners = new Set<() => void>();

function notifyUndownloaded(): void {
  for (const listener of undownloadedListeners) listener();
}

export function subscribeUndownloaded(listener: () => void): () => void {
  undownloadedListeners.add(listener);
  return () => undownloadedListeners.delete(listener);
}

export function getUndownloadedSnapshot(): Record<string, true> {
  return data.undownloaded;
}

export function markDownloaded(bookId: string): void {
  if (!(bookId in data.undownloaded)) return;
  const { [bookId]: _removed, ...rest } = data.undownloaded;
  data.undownloaded = rest;
  notifyUndownloaded();
  scheduleSave();
}

/** Marca un libro como modificado desde la última descarga y persiste. */
function touch(bookId?: string): void {
  if (bookId) data.undownloaded = { ...data.undownloaded, [bookId]: true };
  notifyUndownloaded();
  scheduleSave();
}

// --- Libros --------------------------------------------------------------------

export function createBook(rawBody: unknown): Book {
  const parsed = parse(schemas.bookCreateSchema, rawBody);
  const timestamp = now();
  // `?? null` normaliza el tipo que zod infiere para los campos `longText`
  // (`string | null | undefined`, ver store/schemas.ts) al `string | null`
  // que exige DbBook — en tiempo de ejecución nunca llega `undefined` aquí,
  // pero el tipo estático de zod no lo garantiza.
  const book: DbBook = {
    id: newId(),
    title: parsed.title,
    author: parsed.author ?? null,
    synopsis: parsed.synopsis ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.books.push(book);
  touch(book.id);
  return select.listBooks(data).find((b) => b.id === book.id)!;
}

export function updateBook(id: string, rawBody: unknown): Book {
  const book = data.books.find((b) => b.id === id);
  if (!book) throw notFound('Libro');
  const parsed = parse(schemas.bookUpdateSchema, rawBody);
  // Ver el comentario de updateCharacter.
  Object.assign(book, parsed as Partial<DbBook>);
  book.updatedAt = now();
  touch(id);
  return select.listBooks(data).find((b) => b.id === id)!;
}

export function deleteBook(id: string): void {
  if (!data.books.some((b) => b.id === id)) throw notFound('Libro');

  const characterIds = new Set(data.characters.filter((c) => c.bookId === id).map((c) => c.id));
  const chapterIds = new Set(data.chapters.filter((c) => c.bookId === id).map((c) => c.id));

  data.books = data.books.filter((b) => b.id !== id);
  data.characters = data.characters.filter((c) => c.bookId !== id);
  data.arcStages = data.arcStages.filter((s) => !characterIds.has(s.characterId));
  data.relationships = data.relationships.filter(
    (r) => !characterIds.has(r.characterId) && !characterIds.has(r.relatedCharacterId),
  );
  data.chapters = data.chapters.filter((c) => c.bookId !== id);
  data.cast = data.cast.filter((e) => !chapterIds.has(e.chapterId));
  data.plotEvents = data.plotEvents.filter((e) => e.bookId !== id);
  data.plotPromises = data.plotPromises.filter((p) => p.bookId !== id);

  if (id in data.undownloaded) {
    const { [id]: _removed, ...rest } = data.undownloaded;
    data.undownloaded = rest;
  }
  touch();
}

// --- Personajes ------------------------------------------------------------

export function createCharacter(bookId: string, rawBody: unknown): Character {
  select.assertBookExists(data, bookId);
  const parsed = parse(schemas.characterCreateSchema, rawBody);
  const timestamp = now();
  const character: DbCharacter = {
    id: newId(),
    bookId,
    name: parsed.name,
    role: parsed.role ?? 'SECONDARY',
    age: parsed.age ?? null,
    physicalDescription: parsed.physicalDescription ?? null,
    personality: parsed.personality ?? null,
    backstory: parsed.backstory ?? null,
    personalPlot: parsed.personalPlot ?? null,
    arcSummary: parsed.arcSummary ?? null,
    notes: parsed.notes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.characters.push(character);
  touch(bookId);
  return select.getCharacterOrThrow(data, character.id);
}

export function updateCharacter(id: string, rawBody: unknown): Character {
  const character = data.characters.find((c) => c.id === id);
  if (!character) throw notFound('Personaje');
  const parsed = parse(schemas.characterUpdateSchema, rawBody);
  // `as Partial<DbCharacter>`: los campos ausentes en `rawBody` llegan como
  // `undefined` y zod los omite de `parsed` en tiempo de ejecución (por eso
  // Object.assign no los toca); el tipo estático no puede expresar esa
  // garantía, así que se afirma aquí en vez de reconstruir el objeto campo a
  // campo (aquí sí puede haber "no tocar", a diferencia de un alta).
  Object.assign(character, parsed as Partial<DbCharacter>);
  character.updatedAt = now();
  touch(character.bookId);
  return select.getCharacterOrThrow(data, id);
}

export function deleteCharacter(id: string): void {
  const character = data.characters.find((c) => c.id === id);
  if (!character) throw notFound('Personaje');
  data.characters = data.characters.filter((c) => c.id !== id);
  data.arcStages = data.arcStages.filter((s) => s.characterId !== id);
  data.relationships = data.relationships.filter((r) => r.characterId !== id && r.relatedCharacterId !== id);
  data.cast = data.cast.filter((e) => e.characterId !== id);
  touch(character.bookId);
}

/** Reemplaza la lista entera de etapas, igual que `PUT /characters/:id/arc`. */
export function saveArc(id: string, rawBody: unknown): Character {
  const character = data.characters.find((c) => c.id === id);
  if (!character) throw notFound('Personaje');
  const { stages } = parse(schemas.arcStagesSchema, rawBody);

  data.arcStages = data.arcStages.filter((s) => s.characterId !== id);
  stages.forEach((stage, position) => {
    data.arcStages.push({
      id: newId(),
      characterId: id,
      position,
      title: stage.title,
      description: stage.description ?? null,
    });
  });

  touch(character.bookId);
  return select.getCharacterOrThrow(data, id);
}

export function addRelationship(id: string, rawBody: unknown): Character {
  const subject = data.characters.find((c) => c.id === id);
  if (!subject) throw notFound('Personaje');

  const { reciprocalType, ...parsed } = parse(schemas.relationshipCreateSchema, rawBody);
  if (parsed.relatedCharacterId === id) {
    throw new ApiError(400, 'Un personaje no puede relacionarse consigo mismo');
  }

  const object = data.characters.find((c) => c.id === parsed.relatedCharacterId);
  if (!object) throw notFound('Personaje relacionado');
  if (subject.bookId !== object.bookId) {
    throw new ApiError(400, 'Los dos personajes deben pertenecer al mismo libro');
  }

  // Calca @@unique([characterId, relatedCharacterId, type]): comprobar los DOS
  // sentidos antes de insertar ninguno, igual que la transacción de la API —
  // si la inversa chocaría, tampoco se crea la directa.
  const exists = (characterId: string, relatedCharacterId: string, type: string) =>
    data.relationships.some(
      (r) => r.characterId === characterId && r.relatedCharacterId === relatedCharacterId && r.type === type,
    );

  if (exists(id, parsed.relatedCharacterId, parsed.type)) {
    throw new ApiError(409, 'Ese registro ya existe');
  }
  if (reciprocalType && exists(parsed.relatedCharacterId, id, reciprocalType)) {
    throw new ApiError(409, 'Ese registro ya existe');
  }

  data.relationships.push({
    id: newId(),
    characterId: id,
    relatedCharacterId: parsed.relatedCharacterId,
    type: parsed.type,
    description: parsed.description ?? null,
  });
  if (reciprocalType) {
    data.relationships.push({
      id: newId(),
      characterId: parsed.relatedCharacterId,
      relatedCharacterId: id,
      type: reciprocalType,
      description: null,
    });
  }

  touch(subject.bookId);
  return select.getCharacterOrThrow(data, id);
}

export function deleteRelationship(id: string): void {
  const rel = data.relationships.find((r) => r.id === id);
  if (!rel) throw notFound('Relación');
  data.relationships = data.relationships.filter((r) => r.id !== id);
  const character = data.characters.find((c) => c.id === rel.characterId);
  touch(character?.bookId);
}

// --- Capítulos ---------------------------------------------------------------

export function createChapter(bookId: string, rawBody: unknown): Chapter {
  select.assertBookExists(data, bookId);
  const parsed = parse(schemas.chapterCreateSchema, rawBody);

  // _max y no length: los borrados dejan huecos en la numeración.
  const siblings = data.chapters.filter((c) => c.bookId === bookId);
  const position = siblings.length ? Math.max(...siblings.map((c) => c.position)) + 1 : 0;
  const timestamp = now();

  const chapter: DbChapter = {
    id: newId(),
    bookId,
    position,
    title: parsed.title,
    synopsis: parsed.synopsis ?? null,
    notes: parsed.notes ?? null,
    textALabel: 'Borrador',
    textBLabel: 'Reescritura',
    textA: null,
    textB: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  data.chapters.push(chapter);
  touch(bookId);
  return select.getChapterOrThrow(data, chapter.id);
}

export function updateChapter(id: string, rawBody: unknown): Chapter {
  const chapter = data.chapters.find((c) => c.id === id);
  if (!chapter) throw notFound('Capítulo');
  const parsed = parse(schemas.chapterUpdateSchema, rawBody);
  // Ver el comentario de updateCharacter: campos ausentes llegan omitidos de
  // verdad en tiempo de ejecución, el tipo estático de zod no lo refleja.
  Object.assign(chapter, parsed as Partial<DbChapter>);
  chapter.updatedAt = now();
  touch(chapter.bookId);
  return select.getChapterOrThrow(data, id);
}

export function deleteChapter(id: string): void {
  const chapter = data.chapters.find((c) => c.id === id);
  if (!chapter) throw notFound('Capítulo');
  data.chapters = data.chapters.filter((c) => c.id !== id);
  data.cast = data.cast.filter((e) => e.chapterId !== id);
  touch(chapter.bookId);
}

/** Reemplaza el reparto entero, igual que `PUT /chapters/:id/cast`. */
export function saveChapterCast(id: string, rawBody: unknown): Chapter {
  const chapter = data.chapters.find((c) => c.id === id);
  if (!chapter) throw notFound('Capítulo');
  const { cast } = parse(schemas.chapterCastSchema, rawBody);

  const ids = cast.map((c) => c.characterId);
  if (new Set(ids).size !== ids.length) {
    throw new ApiError(400, 'Un personaje no puede aparecer dos veces en el mismo capítulo');
  }
  for (const characterId of ids) {
    const character = data.characters.find((c) => c.id === characterId);
    if (!character || character.bookId !== chapter.bookId) {
      throw new ApiError(400, 'Los personajes deben pertenecer al libro del capítulo');
    }
  }

  data.cast = data.cast.filter((e) => e.chapterId !== id);
  cast.forEach((entry, position) => {
    data.cast.push({
      id: newId(),
      chapterId: id,
      characterId: entry.characterId,
      position,
      action: entry.action ?? null,
    });
  });

  touch(chapter.bookId);
  return select.getChapterOrThrow(data, id);
}

export function reorderChapters(bookId: string, ids: string[]): ChapterSummary[] {
  select.assertBookExists(data, bookId);
  const current = data.chapters.filter((c) => c.bookId === bookId);
  validateOrderIds(current.map((c) => c.id), ids, 'capítulos');

  const byId = new Map(current.map((c) => [c.id, c]));
  ids.forEach((id, position) => {
    byId.get(id)!.position = position;
  });

  touch(bookId);
  return select.listChapters(data, bookId);
}

// --- Trama -----------------------------------------------------------------

function assertEventsBelongToBook(bookId: string, eventIds: string[]): void {
  for (const eventId of new Set(eventIds)) {
    if (!data.plotEvents.some((e) => e.id === eventId && e.bookId === bookId)) {
      throw new ApiError(400, 'Los sucesos de la promesa deben pertenecer a este libro');
    }
  }
}

export function createPlotEvent(bookId: string, rawBody: unknown): Plot {
  select.assertBookExists(data, bookId);
  const parsed = parse(schemas.plotEventCreateSchema, rawBody);

  const siblings = data.plotEvents.filter((e) => e.bookId === bookId);
  const position = siblings.length ? Math.max(...siblings.map((e) => e.position)) + 1 : 0;
  const timestamp = now();

  data.plotEvents.push({
    id: newId(),
    bookId,
    position,
    title: parsed.title,
    description: parsed.description ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  touch(bookId);
  return select.getPlot(data, bookId);
}

export function updatePlotEvent(id: string, rawBody: unknown): Plot {
  const event = data.plotEvents.find((e) => e.id === id);
  if (!event) throw notFound('Suceso');
  const parsed = parse(schemas.plotEventUpdateSchema, rawBody);
  // Ver el comentario de updateCharacter.
  Object.assign(event, parsed as Partial<DbPlotEvent>);
  event.updatedAt = now();
  touch(event.bookId);
  return select.getPlot(data, event.bookId);
}

export function reorderPlotEvents(bookId: string, ids: string[]): Plot {
  select.assertBookExists(data, bookId);
  const current = data.plotEvents.filter((e) => e.bookId === bookId);
  validateOrderIds(current.map((e) => e.id), ids, 'sucesos');

  const byId = new Map(current.map((e) => [e.id, e]));
  ids.forEach((id, position) => {
    byId.get(id)!.position = position;
  });

  touch(bookId);
  return select.getPlot(data, bookId);
}

/**
 * Borra el suceso: las promesas que se siembran aquí se pierden con él
 * (CASCADE, como `setup_event_id`); las que se pagan aquí vuelven a pendiente
 * (SET NULL, como `payoff_event_id`). Split asimétrico documentado — no
 * "simplificar" a un único comportamiento.
 */
export function deletePlotEvent(id: string): void {
  const event = data.plotEvents.find((e) => e.id === id);
  if (!event) throw notFound('Suceso');

  data.plotEvents = data.plotEvents.filter((e) => e.id !== id);
  data.plotPromises = data.plotPromises.filter((p) => p.setupEventId !== id);
  const timestamp = now();
  for (const promise of data.plotPromises) {
    if (promise.payoffEventId === id) {
      promise.payoffEventId = null;
      promise.updatedAt = timestamp;
    }
  }

  touch(event.bookId);
}

export function createPromise(bookId: string, rawBody: unknown): Plot {
  select.assertBookExists(data, bookId);
  const parsed = parse(schemas.plotPromiseCreateSchema, rawBody);
  assertEventsBelongToBook(
    bookId,
    [parsed.setupEventId, parsed.payoffEventId].filter((id): id is string => id !== null),
  );

  const timestamp = now();
  data.plotPromises.push({
    id: newId(),
    bookId,
    title: parsed.title,
    description: parsed.description ?? null,
    setupEventId: parsed.setupEventId,
    payoffEventId: parsed.payoffEventId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  touch(bookId);
  return select.getPlot(data, bookId);
}

export function updatePromise(id: string, rawBody: unknown): Plot {
  const promise = data.plotPromises.find((p) => p.id === id);
  if (!promise) throw notFound('Promesa');
  const parsed = parse(schemas.plotPromiseUpdateSchema, rawBody);
  assertEventsBelongToBook(
    promise.bookId,
    [parsed.setupEventId, parsed.payoffEventId].filter((id): id is string => !!id),
  );

  // Ver el comentario de updateCharacter.
  Object.assign(promise, parsed as Partial<DbPromise>);
  promise.updatedAt = now();
  touch(promise.bookId);
  return select.getPlot(data, promise.bookId);
}

export function deletePromise(id: string): void {
  const promise = data.plotPromises.find((p) => p.id === id);
  if (!promise) throw notFound('Promesa');
  data.plotPromises = data.plotPromises.filter((p) => p.id !== id);
  touch(promise.bookId);
}
