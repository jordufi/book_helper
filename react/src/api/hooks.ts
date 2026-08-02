import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Book, Character, CharacterSummary } from '../types';

export const keys = {
  books: ['books'] as const,
  characters: (bookId: string) => ['books', bookId, 'characters'] as const,
  character: (id: string) => ['characters', id] as const,
};

// --- Libros ----------------------------------------------------------------

export const useBooks = () =>
  useQuery({ queryKey: keys.books, queryFn: () => api.get<Book[]>('/api/books') });

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; author?: string | null }) =>
      api.post<Book>('/api/books', body),
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

export const useAddRelationship = (bookId: string | null) =>
  useCharacterMutation(
    ({ id, ...body }: { id: string; relatedCharacterId: string; type: string }) =>
      api.post<Character>(`/api/characters/${id}/relationships`, body),
    bookId,
  );

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
