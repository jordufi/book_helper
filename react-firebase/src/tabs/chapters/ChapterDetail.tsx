import { useState } from 'react';
import { useCharacters, useChapter, useDeleteChapter, useUpdateChapter } from '../../api/hooks';
import { ConfirmDialog, ErrorBanner, Prose, Section, Spinner } from '../../components/ui';
import { ChapterCastEditor } from './ChapterCastEditor';
import { ChapterForm } from './ChapterForm';
import { ChapterTextPanels } from './ChapterTextPanels';

export function ChapterDetail({
  chapterId,
  bookId,
  onDeleted,
  onBack,
}: {
  chapterId: string;
  bookId: string | null;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const { data: chapter, isLoading, error } = useChapter(chapterId);
  const { data: characters } = useCharacters(bookId);
  const update = useUpdateChapter(bookId);
  const remove = useDeleteChapter(bookId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;
  if (!chapter) return null;

  return (
    <div className="detail">
      {/* Fuera de detail-head: en móvil la cabecera se apila y el botón debe
          quedar arriba del todo. Oculto en escritorio. */}
      <button className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Capítulos
      </button>

      <div className="detail-head">
        <div className="detail-head-body">
          <span className="grid-count">Capítulo {chapter.position + 1}</span>
          <h1>{chapter.title}</h1>
          <div className="detail-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Editar
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirming(true)}>
              Borrar
            </button>
          </div>
        </div>
      </div>

      <Section title="Sinopsis" filled={!!chapter.synopsis}>
        <Prose text={chapter.synopsis} />
      </Section>

      <Section title="Reparto" filled={chapter.cast.length > 0}>
        <ChapterCastEditor chapter={chapter} candidates={characters ?? []} bookId={bookId} />
      </Section>

      <Section title="Texto" filled={!!chapter.textA || !!chapter.textB}>
        <ChapterTextPanels chapter={chapter} bookId={bookId} />
      </Section>

      <Section title="Notas" filled={!!chapter.notes} defaultOpen={false}>
        <Prose text={chapter.notes} />
      </Section>

      {editing && (
        <ChapterForm
          chapter={chapter}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(false)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: chapter.id, ...values });
            setEditing(false);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Borrar capítulo"
          message={`¿Borrar "${chapter.title}"? Se perderán su texto y su reparto.`}
          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await remove.mutateAsync(chapter.id);
            setConfirming(false);
            onDeleted();
          }}
        />
      )}
    </div>
  );
}
