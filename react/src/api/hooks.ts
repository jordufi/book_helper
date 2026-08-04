import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { downloadTextFile, slugify } from '../lib/downloadFile';
import type {
  Book,
  Chapter,
  ChapterPatch,
  ChapterSummary,
  Character,
  CharacterSummary,
  Plot,
} from '../types';

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
  useQuery({ queryKey: keys.books, queryFn: () => api.get<Book[]>('/api/books') });

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; author?: string | null; synopsis?: string | null }) =>
      api.post<Book>('/api/books', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      author?: string | null;
      synopsis?: string | null;
    }) => api.patch<Book>(`/api/books/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/books/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

/** Descarga el volcado JSON de un libro (sin fotos) generado por la API. */
export function useExportBook() {
  return useMutation({
    mutationFn: async (book: Book) => {
      const data = await api.get<unknown>(`/api/books/${book.id}/export`);
      downloadTextFile(`${slugify(book.title)}.json`, JSON.stringify(data, null, 2), 'application/json');
    },
  });
}

/** Crea un libro NUEVO a partir de un JSON exportado con useExportBook. */
export function useImportBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => api.post<Book>('/api/books/import', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.books }),
  });
}

// --- Personajes ------------------------------------------------------------

export const useCharacters = (bookId: string | null) =>
  useQuery({
    queryKey: keys.characters(bookId ?? ''),
    queryFn: () => api.get<CharacterSummary[]>(`/api/books/${bookId}/characters`),
    enabled: Boolean(bookId),
  });

export const useCharacter = (id: string | null) =>
  useQuery({
    queryKey: keys.character(id ?? ''),
    queryFn: () => api.get<Character>(`/api/characters/${id}`),
    enabled: Boolean(id),
  });

/**
 * Las mutaciones de personaje devuelven el detalle completo recargado, así que
 * sembramos la caché con la respuesta en vez de invalidar y volver a pedirlo.
 * La lista sí se invalida: nombre, rol o foto pueden haber cambiado en ella.
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
    (body: Record<string, unknown>) => api.post<Character>(`/api/books/${bookId}/characters`, body),
    bookId,
  );

export const useUpdateCharacter = (bookId: string | null) =>
  useCharacterMutation(
    ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Character>(`/api/characters/${id}`, body),
    bookId,
  );

export const useSaveArc = (bookId: string | null) =>
  useCharacterMutation(
    ({ id, stages }: { id: string; stages: { title: string; description: string | null }[] }) =>
      api.put<Character>(`/api/characters/${id}/arc`, { stages }),
    bookId,
  );

interface AddRelationshipArgs {
  id: string;
  relatedCharacterId: string;
  type: string;
  description?: string | null;
  /** Opt-in: si se envía, la API crea también la relación inversa. */
  reciprocalType?: string | null;
}

export function useAddRelationship(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AddRelationshipArgs) =>
      api.post<Character>(`/api/characters/${id}/relationships`, body),
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

export const useUploadPhoto = (bookId: string | null) =>
  useCharacterMutation(
    ({ id, file }: { id: string; file: File }) =>
      api.upload<Character>(`/api/characters/${id}/photo`, file),
    bookId,
  );

export const useDeletePhoto = (bookId: string | null) =>
  useCharacterMutation(
    ({ id }: { id: string }) => api.delete<Character>(`/api/characters/${id}/photo`),
    bookId,
  );

export function useDeleteRelationship(bookId: string | null, characterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/relationships/${id}`),
    onSuccess: () => {
      if (characterId) qc.invalidateQueries({ queryKey: keys.character(characterId) });
      if (bookId) qc.invalidateQueries({ queryKey: keys.characters(bookId) });
    },
  });
}

export function useDeleteCharacter(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/characters/${id}`),
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
    queryFn: () => api.get<ChapterSummary[]>(`/api/books/${bookId}/chapters`),
    enabled: Boolean(bookId),
  });

export const useChapter = (id: string | null) =>
  useQuery({
    queryKey: keys.chapter(id ?? ''),
    queryFn: () => api.get<Chapter>(`/api/chapters/${id}`),
    enabled: Boolean(id),
  });

/** Calco de useCharacterMutation: la API devuelve el capítulo completo recargado. */
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
    (body: { title: string; synopsis?: string | null; notes?: string | null }) =>
      api.post<Chapter>(`/api/books/${bookId}/chapters`, body),
    bookId,
  );

export const useUpdateChapter = (bookId: string | null) =>
  useChapterMutation(
    ({ id, ...body }: { id: string } & ChapterPatch) => api.patch<Chapter>(`/api/chapters/${id}`, body),
    bookId,
  );

export const useSaveChapterCast = (bookId: string | null) =>
  useChapterMutation(
    ({ id, cast }: { id: string; cast: { characterId: string; action: string | null }[] }) =>
      api.put<Chapter>(`/api/chapters/${id}/cast`, { cast }),
    bookId,
  );

export function useReorderChapters(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.put<ChapterSummary[]>(`/api/books/${bookId}/chapters/order`, { ids }),
    onSuccess: (list) => {
      if (bookId) qc.setQueryData(keys.chapters(bookId), list);
      // Las fichas en caché llevan `position`: tras reordenar están obsoletas.
      qc.invalidateQueries({ queryKey: ['chapters'] });
    },
  });
}

export function useDeleteChapter(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/chapters/${id}`),
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
    queryFn: () => api.get<Plot>(`/api/books/${bookId}/plot`),
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
    (body: { title: string; description: string | null }) =>
      api.post<Plot>(`/api/books/${bookId}/plot/events`, body),
    bookId,
  );

export const useUpdatePlotEvent = (bookId: string | null) =>
  usePlotMutation(
    ({ id, ...body }: { id: string; title?: string; description?: string | null }) =>
      api.patch<Plot>(`/api/plot-events/${id}`, body),
    bookId,
  );

export const useReorderPlotEvents = (bookId: string | null) =>
  usePlotMutation(
    (ids: string[]) => api.put<Plot>(`/api/books/${bookId}/plot/events/order`, { ids }),
    bookId,
  );

export const useCreatePromise = (bookId: string | null) =>
  usePlotMutation(
    (body: {
      title: string;
      description: string | null;
      setupEventId: string;
      payoffEventId: string | null;
    }) => api.post<Plot>(`/api/books/${bookId}/plot/promises`, body),
    bookId,
  );

export const useUpdatePromise = (bookId: string | null) =>
  usePlotMutation(
    ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string | null;
      setupEventId?: string;
      payoffEventId?: string | null;
    }) => api.patch<Plot>(`/api/plot-promises/${id}`, body),
    bookId,
  );

export function useDeletePlotEvent(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/plot-events/${id}`),
    onSuccess: () => {
      if (bookId) qc.invalidateQueries({ queryKey: keys.plot(bookId) });
    },
  });
}

export function useDeletePromise(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/plot-promises/${id}`),
    onSuccess: () => {
      if (bookId) qc.invalidateQueries({ queryKey: keys.plot(bookId) });
    },
  });
}
