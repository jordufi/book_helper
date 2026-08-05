import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as booksDb from '../db/books';
import * as charactersDb from '../db/characters';
import * as chaptersDb from '../db/chapters';
import * as plotDb from '../db/plot';
import { importBook as importBookDb } from '../db/transfer';
import type { Book, Chapter, ChapterPatch, Character, CharacterInput, Plot } from '../types';

/**
 * Mismas claves de caché que en la web. Aquí no hay servidor —los datos salen
 * de SQLite en el propio dispositivo— pero react-query sigue mereciendo la
 * pena: da la misma invalidación en cascada que ya teníamos diseñada y evita
 * recargar la lista entera en cada pantalla.
 */
export const keys = {
  books: ['books'] as const,
  characters: (bookId: string) => ['books', bookId, 'characters'] as const,
  character: (id: string) => ['characters', id] as const,
  chapters: (bookId: string) => ['books', bookId, 'chapters'] as const,
  chapter: (id: string) => ['chapters', id] as const,
  /** Sucesos y promesas comparten clave: se cargan y se invalidan juntos. */
  plot: (bookId: string) => ['books', bookId, 'plot'] as const,
};

// --- Libros ------------------------------------------------------------------

export const useBooks = () => useQuery({ queryKey: keys.books, queryFn: booksDb.listBooks });

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: booksDb.createBook,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Parameters<typeof booksDb.updateBook>[1]) =>
      booksDb.updateBook(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: booksDb.deleteBook,
    // Al borrar un libro se van en cascada sus personajes, capítulos y trama:
    // se invalida todo, no sólo la lista de libros.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useImportBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => importBookDb(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

// --- Personajes --------------------------------------------------------------

export const useCharacters = (bookId: string | null) =>
  useQuery({
    queryKey: keys.characters(bookId ?? ''),
    queryFn: () => charactersDb.listCharacters(bookId!),
    enabled: Boolean(bookId),
  });

export const useCharacter = (id: string | null) =>
  useQuery({
    queryKey: keys.character(id ?? ''),
    queryFn: () => charactersDb.getCharacter(id!),
    enabled: Boolean(id),
  });

/**
 * Las mutaciones de personaje devuelven el detalle completo recargado, así que
 * se siembra la caché con la respuesta en vez de invalidar y volver a leer.
 * La lista sí se invalida: nombre, rol o arco pueden haber cambiado en ella.
 */
function useCharacterMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<Character>,
  bookId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (character) => {
      qc.setQueryData(keys.character(character.id), character);
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
      qc.invalidateQueries({ queryKey: keys.books });
    },
  });
}

export const useCreateCharacter = (bookId: string | null) =>
  useCharacterMutation((input: CharacterInput) => charactersDb.createCharacter(bookId!, input), bookId);

export const useUpdateCharacter = (bookId: string | null) =>
  useCharacterMutation(
    ({ id, ...patch }: { id: string } & CharacterInput) => charactersDb.updateCharacter(id, patch),
    bookId,
  );

export const useSaveArc = (bookId: string | null) =>
  useCharacterMutation(
    ({ id, stages }: { id: string; stages: { title: string; description: string | null }[] }) =>
      charactersDb.saveArc(id, stages),
    bookId,
  );

export function useAddRelationship(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      relatedCharacterId: string;
      type: string;
      description?: string | null;
      reciprocalType?: string | null;
    }) => charactersDb.addRelationship(id, input),
    onSuccess: (character, variables) => {
      qc.setQueryData(keys.character(character.id), character);
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
      // Si se creó también la inversa, la ficha del otro personaje ha cambiado.
      if (variables.reciprocalType) {
        qc.invalidateQueries({ queryKey: keys.character(variables.relatedCharacterId) });
      }
    },
  });
}

export function useDeleteRelationship(bookId: string | null, characterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: charactersDb.deleteRelationship,
    onSuccess: () => {
      if (characterId) qc.invalidateQueries({ queryKey: keys.character(characterId) });
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
    },
  });
}

export function useDeleteCharacter(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: charactersDb.deleteCharacter,
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.character(id) });
      if (bookId) {
        qc.invalidateQueries({ queryKey: keys.characters(bookId) });
        // El personaje sale del reparto de sus capítulos por CASCADE.
        qc.invalidateQueries({ queryKey: keys.chapters(bookId) });
      }
    },
  });
}

// --- Capítulos ---------------------------------------------------------------

export const useChapters = (bookId: string | null) =>
  useQuery({
    queryKey: keys.chapters(bookId ?? ''),
    queryFn: () => chaptersDb.listChapters(bookId!),
    enabled: Boolean(bookId),
  });

export const useChapter = (id: string | null) =>
  useQuery({
    queryKey: keys.chapter(id ?? ''),
    queryFn: () => chaptersDb.getChapter(id!),
    enabled: Boolean(id),
  });

function useChapterMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<Chapter>,
  bookId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (chapter) => {
      qc.setQueryData(keys.chapter(chapter.id), chapter);
      if (bookId) qc.invalidateQueries({ queryKey: keys.chapters(bookId) });
      qc.invalidateQueries({ queryKey: keys.books });
    },
  });
}

export const useCreateChapter = (bookId: string | null) =>
  useChapterMutation(
    (input: { title: string; synopsis?: string | null; notes?: string | null }) =>
      chaptersDb.createChapter(bookId!, input),
    bookId,
  );

export const useUpdateChapter = (bookId: string | null) =>
  useChapterMutation(
    ({ id, ...patch }: { id: string } & ChapterPatch) => chaptersDb.updateChapter(id, patch),
    bookId,
  );

export const useSaveCast = (bookId: string | null) =>
  useChapterMutation(
    ({ id, cast }: { id: string; cast: { characterId: string; action: string | null }[] }) =>
      chaptersDb.saveCast(id, cast),
    bookId,
  );

export function useReorderChapters(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => chaptersDb.reorderChapters(bookId!, ids),
    onSuccess: (chapters) => {
      if (bookId) qc.setQueryData(keys.chapters(bookId), chapters);
      // Los detalles en caché llevan `position` y quedan obsoletos.
      qc.invalidateQueries({ queryKey: ['chapters'] });
    },
  });
}

export function useDeleteChapter(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chaptersDb.deleteChapter,
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.chapter(id) });
      if (bookId) qc.invalidateQueries({ queryKey: keys.chapters(bookId) });
      qc.invalidateQueries({ queryKey: keys.books });
    },
  });
}

// --- Trama -------------------------------------------------------------------

export const usePlot = (bookId: string | null) =>
  useQuery({
    queryKey: keys.plot(bookId ?? ''),
    queryFn: () => plotDb.loadPlot(bookId!),
    enabled: Boolean(bookId),
  });

/**
 * Toda mutación de trama devuelve `{ events, promises }` entero: borrar un
 * suceso puede arrastrar promesas (CASCADE en la siembra) y dejar otras
 * pendientes (SET NULL en el pago) a la vez.
 */
function usePlotMutation<TArgs>(mutationFn: (args: TArgs) => Promise<Plot>, bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (plot) => {
      if (bookId) qc.setQueryData(keys.plot(bookId), plot);
      qc.invalidateQueries({ queryKey: keys.books });
    },
  });
}

export const useCreateEvent = (bookId: string | null) =>
  usePlotMutation(
    (input: { title: string; description?: string | null }) => plotDb.createEvent(bookId!, input),
    bookId,
  );

export const useUpdateEvent = (bookId: string | null) =>
  usePlotMutation(
    ({ id, ...patch }: { id: string; title?: string; description?: string | null }) =>
      plotDb.updateEvent(id, patch),
    bookId,
  );

export const useDeleteEvent = (bookId: string | null) =>
  usePlotMutation((id: string) => plotDb.deleteEvent(id), bookId);

export const useReorderEvents = (bookId: string | null) =>
  usePlotMutation((ids: string[]) => plotDb.reorderEvents(bookId!, ids), bookId);

export const useCreatePromise = (bookId: string | null) =>
  usePlotMutation(
    (input: {
      title: string;
      description?: string | null;
      setupEventId: string;
      payoffEventId?: string | null;
    }) => plotDb.createPromise(bookId!, input),
    bookId,
  );

export const useUpdatePromise = (bookId: string | null) =>
  usePlotMutation(
    ({
      id,
      ...patch
    }: {
      id: string;
      title?: string;
      description?: string | null;
      setupEventId?: string;
      payoffEventId?: string | null;
    }) => plotDb.updatePromise(id, patch),
    bookId,
  );

export const useDeletePromise = (bookId: string | null) =>
  usePlotMutation((id: string) => plotDb.deletePromise(id), bookId);

export type { Book };
