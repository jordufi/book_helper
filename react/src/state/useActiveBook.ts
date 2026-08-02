import { useEffect, useState } from 'react';
import { useBooks } from '../api/hooks';
import type { Book } from '../types';

const STORAGE_KEY = 'book-helper:libro-activo';

/**
 * Libro activo, recordado entre sesiones. Es el único estado global propio de
 * la app; todo lo demás viene del servidor y lo gestiona react-query.
 */
export function useActiveBook() {
  const { data: books, isLoading, error } = useBooks();
  const [bookId, setBookId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (!books) return;

    // El libro guardado puede haberse borrado desde otro dispositivo o pestaña.
    const stored = bookId && books.some((b) => b.id === bookId);
    if (!stored) setBookId(books[0]?.id ?? null);
  }, [books, bookId]);

  useEffect(() => {
    if (bookId) localStorage.setItem(STORAGE_KEY, bookId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [bookId]);

  const activeBook: Book | null = books?.find((b) => b.id === bookId) ?? null;

  return { books: books ?? [], activeBook, bookId: activeBook?.id ?? null, setBookId, isLoading, error };
}
