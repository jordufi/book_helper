import { useState } from 'react';
import { useCreateBook } from '../api/hooks';
import { Modal, ErrorBanner } from './ui';
import type { Book } from '../types';

export function BookSelector({
  books,
  bookId,
  onSelect,
  onManage,
}: {
  books: Book[];
  bookId: string | null;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const createBook = useCreateBook();

  const submit = async () => {
    if (!title.trim()) return;
    const book = await createBook.mutateAsync({ title: title.trim(), author: author.trim() || null });
    onSelect(book.id);
    setCreating(false);
    setTitle('');
    setAuthor('');
  };

  return (
    <>
      <select
        className="select"
        style={{ width: 'auto', minWidth: 180 }}
        value={bookId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Libro activo"
      >
        {books.length === 0 && <option value="">Sin libros</option>}
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
            {b._count ? ` · ${b._count.characters}` : ''}
          </option>
        ))}
      </select>

      <button className="btn btn-sm" onClick={() => setCreating(true)}>
        + Libro
      </button>

      <button className="btn btn-ghost btn-sm" onClick={onManage}>
        Gestionar libros
      </button>

      {creating && (
        <Modal
          title="Nuevo libro"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={!title.trim() || createBook.isPending}
              >
                {createBook.isPending ? 'Creando…' : 'Crear'}
              </button>
            </>
          }
        >
          <ErrorBanner error={createBook.error} />
          <div className="field">
            <label htmlFor="book-title">Título</label>
            <input
              id="book-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="book-author">Autor</label>
            <input
              id="book-author"
              className="input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
