import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { downloadTextFile, slugify } from '../lib/downloadFile';
import * as select from '../store/select';
import * as store from '../store/store';
import * as transfer from '../store/transfer';
import type { Book, Chapter, ChapterPatch, ChapterSummary, Character, Plot } from '../types';

/**
 * Mismos nombres, mismas firmas, mismas claves de caché e invalidaciones que
 * `react/src/api/hooks.ts` — es el seam a propósito (ver CLAUDE.md): sólo
 * cambia el cuerpo de cada `queryFn`/`mutationFn`, que ya no llama a `fetch`
 * sino directamente al store en memoria (`src/store/`). Los tres helpers
 * privados de mutación siguen siendo correctos sin tocarlos porque el store
 * también devuelve el agregado completo recargado, igual que hacía la API.
 *
 * Se conserva react-query aunque no haya red: así los ~20 componentes que
 * consumen estos hooks (isPending, error, mutateAsync, data…) se copian sin
 * tocar una línea.
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

// --- Libros ----------------------------------------------------------------

export const useBooks = () =>
  useQuery({ queryKey: keys.books, queryFn: async () => select.listBooks(store.getData()) });

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; author?: string | null; synopsis?: string | null }) =>
      store.createBook(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      author?: string | null;
      synopsis?: string | null;
    }) => store.updateBook(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => store.deleteBook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

/** Descarga el volcado JSON de un libro (sin fotos) y limpia su aviso de "sin descargar". */
export function useExportBook() {
  return useMutation({
    mutationFn: async (book: Book) => {
      const data = transfer.exportBook(book.id);
      downloadTextFile(`${slugify(book.title)}.json`, JSON.stringify(data, null, 2), 'application/json');
      store.markDownloaded(book.id);
    },
  });
}

/** Crea un libro NUEVO a partir de un JSON exportado con useExportBook. */
export function useImportBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => transfer.importBook(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

/** Libros con cambios desde la última descarga a JSON (ver BooksTab). */
export function useUndownloaded(): Record<string, true> {
  return useSyncExternalStore(store.subscribeUndownloaded, store.getUndownloadedSnapshot);
}

// --- Personajes ------------------------------------------------------------

export const useCharacters = (bookId: string | null) =>
  useQuery({
    queryKey: keys.characters(bookId ?? ''),
    queryFn: async () => select.listCharacters(store.getData(), bookId!),
    enabled: Boolean(bookId),
  });

export const useCharacter = (id: string | null) =>
  useQuery({
    queryKey: keys.character(id ?? ''),
    queryFn: async () => select.getCharacterOrThrow(store.getData(), id!),
    enabled: Boolean(id),
  });

/**
 * El store devuelve el detalle completo recargado, así que sembramos la
 * caché con la respuesta en vez de invalidar y volver a pedirlo. La lista sí
 * se invalida: nombre, rol o edad pueden haber cambiado en ella.
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
    },
  });
}

export const useCreateCharacter = (bookId: string | null) =>
  useCharacterMutation(
    async (body: Record<string, unknown>) => store.createCharacter(bookId!, body),
    bookId,
  );

export const useUpdateCharacter = (bookId: string | null) =>
  useCharacterMutation(
    async ({ id, ...body }: { id: string } & Record<string, unknown>) => store.updateCharacter(id, body),
    bookId,
  );

export const useSaveArc = (bookId: string | null) =>
  useCharacterMutation(
    async ({ id, stages }: { id: string; stages: { title: string; description: string | null }[] }) =>
      store.saveArc(id, { stages }),
    bookId,
  );

interface AddRelationshipArgs {
  id: string;
  relatedCharacterId: string;
  type: string;
  description?: string | null;
  /** Opt-in: si se envía, se crea también la relación inversa. */
  reciprocalType?: string | null;
}

export function useAddRelationship(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: AddRelationshipArgs) => store.addRelationship(id, body),
    onSuccess: (character, variables) => {
      qc.setQueryData(keys.character(character.id), character);
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
      // Si se creó también la inversa, la ficha del otro personaje puede
      // estar en caché con datos obsoletos.
      if (variables.reciprocalType) {
        qc.invalidateQueries({ queryKey: keys.character(variables.relatedCharacterId) });
      }
    },
  });
}

export function useDeleteRelationship(bookId: string | null, characterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => store.deleteRelationship(id),
    onSuccess: () => {
      if (characterId) qc.invalidateQueries({ queryKey: keys.character(characterId) });
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
    },
  });
}

export function useDeleteCharacter(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => store.deleteCharacter(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.character(id) });
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
    },
  });
}

// --- Capítulos ---------------------------------------------------------------

export const useChapters = (bookId: string | null) =>
  useQuery({
    queryKey: keys.chapters(bookId ?? ''),
    queryFn: async () => select.listChapters(store.getData(), bookId!),
    enabled: Boolean(bookId),
  });

export const useChapter = (id: string | null) =>
  useQuery({
    queryKey: keys.chapter(id ?? ''),
    queryFn: async () => select.getChapterOrThrow(store.getData(), id!),
    enabled: Boolean(id),
  });

/** Calco de useCharacterMutation: el store devuelve el capítulo completo recargado. */
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
    },
  });
}

export const useCreateChapter = (bookId: string | null) =>
  useChapterMutation(
    async (body: { title: string; synopsis?: string | null; notes?: string | null }) =>
      store.createChapter(bookId!, body),
    bookId,
  );

export const useUpdateChapter = (bookId: string | null) =>
  useChapterMutation(
    async ({ id, ...body }: { id: string } & ChapterPatch) => store.updateChapter(id, body),
    bookId,
  );

export const useSaveChapterCast = (bookId: string | null) =>
  useChapterMutation(
    async ({ id, cast }: { id: string; cast: { characterId: string; action: string | null }[] }) =>
      store.saveChapterCast(id, { cast }),
    bookId,
  );

export function useReorderChapters(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => store.reorderChapters(bookId!, ids),
    onSuccess: (list: ChapterSummary[]) => {
      if (bookId) qc.setQueryData(keys.chapters(bookId), list);
      // Las fichas en caché llevan `position`: tras reordenar están obsoletas.
      qc.invalidateQueries({ queryKey: ['chapters'] });
    },
  });
}

export function useDeleteChapter(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => store.deleteChapter(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.chapter(id) });
      if (bookId) qc.invalidateQueries({ queryKey: keys.chapters(bookId) });
    },
  });
}

// --- Trama ---------------------------------------------------------------------

export const usePlot = (bookId: string | null) =>
  useQuery({
    queryKey: keys.plot(bookId ?? ''),
    queryFn: async () => select.getPlot(store.getData(), bookId!),
    enabled: Boolean(bookId),
  });

/**
 * Toda mutación de trama devuelve { events, promises } recargado: borrar o
 * mover un suceso puede arrastrar promesas o dejarlas pendientes, así que
 * devolver sólo el elemento tocado no permite reconstruir la vista.
 */
function usePlotMutation<TArgs>(mutationFn: (args: TArgs) => Promise<Plot>, bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (plot) => {
      if (bookId) qc.setQueryData(keys.plot(bookId), plot);
    },
  });
}

export const useCreatePlotEvent = (bookId: string | null) =>
  usePlotMutation(
    async (body: { title: string; description: string | null }) => store.createPlotEvent(bookId!, body),
    bookId,
  );

export const useUpdatePlotEvent = (bookId: string | null) =>
  usePlotMutation(
    async ({ id, ...body }: { id: string; title?: string; description?: string | null }) =>
      store.updatePlotEvent(id, body),
    bookId,
  );

export const useReorderPlotEvents = (bookId: string | null) =>
  usePlotMutation(async (ids: string[]) => store.reorderPlotEvents(bookId!, ids), bookId);

export const useCreatePromise = (bookId: string | null) =>
  usePlotMutation(
    async (body: {
      title: string;
      description: string | null;
      setupEventId: string;
      payoffEventId: string | null;
    }) => store.createPromise(bookId!, body),
    bookId,
  );

export const useUpdatePromise = (bookId: string | null) =>
  usePlotMutation(
    async ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string | null;
      setupEventId?: string;
      payoffEventId?: string | null;
    }) => store.updatePromise(id, body),
    bookId,
  );

export function useDeletePlotEvent(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => store.deletePlotEvent(id),
    onSuccess: () => {
      if (bookId) qc.invalidateQueries({ queryKey: keys.plot(bookId) });
    },
  });
}

export function useDeletePromise(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => store.deletePromise(id),
    onSuccess: () => {
      if (bookId) qc.invalidateQueries({ queryKey: keys.plot(bookId) });
    },
  });
}
