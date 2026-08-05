import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { useBooks } from '../data/hooks';
import type { Book } from '../types';

const STORAGE_KEY = 'book-helper:libro-activo';

interface ActiveBookValue {
  books: Book[];
  activeBook: Book | null;
  bookId: string | null;
  setBookId: (id: string | null) => void;
  isLoading: boolean;
  error: unknown;
}

const ActiveBookContext = createContext<ActiveBookValue | null>(null);

/**
 * Libro activo, recordado entre arranques. Es el único estado global propio de
 * la app; todo lo demás sale de SQLite y lo gestiona react-query.
 *
 * Va en un Context y NO en un hook con `useState` suelto: las pantallas de las
 * pestañas se quedan montadas al cambiar de una a otra, así que si cada una
 * tuviera su propia copia del libro activo, cambiarlo en "Libros" no llegaría
 * a las demás — seguirían mostrando los datos del libro anterior hasta
 * remontarse. En la web esto no pasaba porque `useActiveBook` se llamaba una
 * sola vez en App.tsx y el id bajaba por props.
 *
 * Se persiste con `expo-sqlite/kv-store` (API tipo AsyncStorage respaldada por
 * la misma SQLite que ya usamos) para no arrastrar AsyncStorage aparte.
 */
export function ActiveBookProvider({ children }: { children: ReactNode }) {
  const { data: books, isLoading, error } = useBooks();
  const [bookId, setBookId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Lectura inicial del valor guardado.
  useEffect(() => {
    let cancelled = false;
    Storage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled) setBookId(stored ?? null);
      })
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // El libro guardado puede haberse borrado; en ese caso, caer al primero.
  // Sólo tras restaurar, para no pisar el valor guardado durante el arranque.
  useEffect(() => {
    if (!restored || !books) return;
    const stillExists = bookId && books.some((b) => b.id === bookId);
    if (!stillExists) setBookId(books[0]?.id ?? null);
  }, [books, bookId, restored]);

  useEffect(() => {
    if (!restored) return;
    if (bookId) void Storage.setItem(STORAGE_KEY, bookId);
    else void Storage.removeItem(STORAGE_KEY);
  }, [bookId, restored]);

  const value = useMemo<ActiveBookValue>(() => {
    const activeBook = books?.find((b) => b.id === bookId) ?? null;
    return {
      books: books ?? [],
      activeBook,
      bookId: activeBook?.id ?? null,
      setBookId,
      isLoading: isLoading || !restored,
      error,
    };
  }, [books, bookId, isLoading, restored, error]);

  return <ActiveBookContext.Provider value={value}>{children}</ActiveBookContext.Provider>;
}

export function useActiveBook(): ActiveBookValue {
  const value = useContext(ActiveBookContext);
  if (!value) {
    throw new Error('useActiveBook debe usarse dentro de <ActiveBookProvider>');
  }
  return value;
}
