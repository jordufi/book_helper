import { useRef, useState } from 'react';
import {
  useCreateBook,
  useDeleteBook,
  useExportBook,
  useImportBook,
  useUpdateBook,
} from '../../api/hooks';
import { ConfirmDialog, ErrorBanner } from '../../components/ui';
import type { Book } from '../../types';
import { BookForm } from './BookForm';

export function BooksTab({
  books,
  activeBookId,
  onImported,
}: {
  books: Book[];
  activeBookId: string | null;
  onImported: (bookId: string) => void;
}) {
  const create = useCreateBook();
  const update = useUpdateBook();
  const remove = useDeleteBook();
  const exportBook = useExportBook();
  const importBook = useImportBook();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [confirming, setConfirming] = useState<Book | null>(null);
  const [importError, setImportError] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File) => {
    setImportError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const book = await importBook.mutateAsync(parsed);
      onImported(book.id);
    } catch (err) {
      setImportError(
        err instanceof SyntaxError ? new Error('El fichero no es un JSON válido') : err,
      );
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Gestionar libros</h1>
      <div className="grid-head">
        <span className="grid-count">
          {books.length} {books.length === 1 ? 'libro' : 'libros'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImportFile(file);
            }}
          />
          <button
            className="btn btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importBook.isPending}
          >
            {importBook.isPending ? 'Importando…' : 'Importar libro (JSON)'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
            + Libro
          </button>
        </div>
      </div>

      <ErrorBanner error={create.error ?? update.error ?? remove.error ?? exportBook.error ?? importError} />

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
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => exportBook.mutate(b)}
                disabled={exportBook.isPending}
              >
                Exportar JSON
              </button>
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
