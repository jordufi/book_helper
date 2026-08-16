import { useState } from 'react';
import { useChapters, useCreateChapter, useReorderChapters } from '../../api/hooks';
import { ErrorBanner, Spinner } from '../../components/ui';
import { useOrderDraft } from '../../lib/useOrderDraft';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
import type { ChapterSummary } from '../../types';
import { ChapterDetail } from './ChapterDetail';
import { ChapterForm } from './ChapterForm';

function ChapterCard({
  chapter,
  active,
  onClick,
}: {
  chapter: ChapterSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="list-card" aria-current={active} onClick={onClick}>
      <div className="chapter-num">{chapter.position + 1}</div>
      <div className="list-card-body">
        <div className="list-card-title">{chapter.title}</div>
        <div className="list-card-meta">
          {chapter.synopsis && <span>{chapter.synopsis}</span>}
          {chapter.synopsis && ' · '}
          {chapter._count.cast} {chapter._count.cast === 1 ? 'personaje' : 'personajes'}
        </div>
      </div>
    </button>
  );
}

export function ChaptersTab({
  bookId,
  chapterId,
  onSelect,
}: {
  bookId: string | null;
  chapterId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data: chapters, isLoading, error } = useChapters(bookId);
  const create = useCreateChapter(bookId);
  const reorder = useReorderChapters(bookId);
  const [creating, setCreating] = useState(false);
  const order = useOrderDraft(chapters ?? []);

  const saveOrder = async () => {
    await reorder.mutateAsync(order.ids);
    order.cancel();
  };
  useUnsavedChanges({ dirty: order.dirty, saving: reorder.isPending, onSave: saveOrder });

  if (!bookId) {
    return (
      <div className="placeholder">
        <h1>Sin libro</h1>
        <p>Crea un libro arriba para empezar a ordenar sus capítulos.</p>
      </div>
    );
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;

  const list = chapters ?? [];
  // En móvil sólo cabe un panel: la lista o la ficha. Lo decide el CSS.
  const view = chapterId ? 'detail' : 'list';

  return (
    <div className="master-detail" data-view={view}>
      <div className="grid-panel">
        <div className="grid-head">
          <span className="grid-count">
            {list.length} {list.length === 1 ? 'capítulo' : 'capítulos'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {list.length > 1 && !order.reordering && (
              <button className="btn btn-sm" onClick={order.start}>
                Reordenar
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
              + Capítulo
            </button>
          </div>
        </div>

        <ErrorBanner error={reorder.error} />

        {list.length === 0 ? (
          <p className="empty-note">Todavía no hay capítulos en este libro.</p>
        ) : order.reordering ? (
          <>
            {order.draft.map((c, i) => (
              <div className="stage" key={c.id}>
                <div className="chapter-num">{i + 1}</div>
                <div className="stage-body" style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="stage-ctrl">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => order.move(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => order.move(i, 1)}
                    disabled={i === order.draft.length - 1}
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={order.cancel} disabled={reorder.isPending}>
                Cancelar
              </button>
              <button className="btn btn-sm btn-primary" onClick={saveOrder} disabled={reorder.isPending}>
                {reorder.isPending ? 'Guardando…' : 'Guardar orden'}
              </button>
            </div>
          </>
        ) : (
          <div className="card-list">
            {list.map((c) => (
              <ChapterCard
                key={c.id}
                chapter={c}
                active={c.id === chapterId}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="detail-panel">
        {chapterId ? (
          <ChapterDetail
            chapterId={chapterId}
            bookId={bookId}
            onDeleted={() => onSelect(null)}
            onBack={() => onSelect(null)}
          />
        ) : (
          <div className="placeholder">
            <h2>Ningún capítulo seleccionado</h2>
            <p>Elige uno de la lista o crea el primero.</p>
          </div>
        )}
      </div>

      {creating && (
        <ChapterForm
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const chapter = await create.mutateAsync(values);
            setCreating(false);
            onSelect(chapter.id);
          }}
        />
      )}
    </div>
  );
}
