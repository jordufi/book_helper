import { useState } from 'react';
import { useCreateBook, useDeleteBook, useUpdateBook } from '../../api/hooks';
import { ConfirmDialog, ErrorBanner } from '../../components/ui';
import type { Book } from '../../types';
import { BookForm } from './BookForm';

export function BooksTab({ books, activeBookId }: { books: Book[]; activeBookId: string | null }) {
  const create = useCreateBook();
  const update = useUpdateBook();
  const remove = useDeleteBook();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [confirming, setConfirming] = useState<Book | null>(null);

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Gestionar libros</h1>
      <div className="grid-head">
        <span className="grid-count">
          {books.length} {books.length === 1 ? 'libro' : 'libros'}
        </span>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          + Libro
        </button>
      </div>

      <ErrorBanner error={create.error ?? update.error ?? remove.error} />

      {books.length === 0 ? (
        <p className="empty-note">Todavía no hay libros. Crea el primero para empezar.</p>
      ) : (
        <div className="card-list" style={{ marginTop: 12 }}>
          {books.map((b) => (
            <div className="rel" key={b.id}>
              <div className="rel-body">
                <div className="list-card-title">
                  {b.title}
                  {b.id === activeBookId && (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      Activo
                    </span>
                  )}
                </div>
                <div className="list-card-meta">
                  {b.author && `${b.author} · `}
                  {b._count?.characters ?? 0} {b._count?.characters === 1 ? 'personaje' : 'personajes'} ·{' '}
                  {b._count?.chapters ?? 0} {b._count?.chapters === 1 ? 'capítulo' : 'capítulos'}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(b)}>
                Editar
              </button>
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirming(b)}>
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <BookForm
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <BookForm
          book={editing}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: editing.id, ...values });
            setEditing(null);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Borrar libro"
          message={`¿Borrar "${confirming.title}"? Se perderán sus personajes, capítulos y toda su trama. No se puede deshacer.`}
          pending={remove.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            await remove.mutateAsync(confirming.id);
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}
