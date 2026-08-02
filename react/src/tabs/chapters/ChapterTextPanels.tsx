import { useEffect, useState } from 'react';
import { useUpdateChapter } from '../../api/hooks';
import { ErrorBanner } from '../../components/ui';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
import type { Chapter, ChapterPatch } from '../../types';

interface Draft {
  textALabel: string;
  textA: string;
  textBLabel: string;
  textB: string;
}

const fromChapter = (c: Chapter): Draft => ({
  textALabel: c.textALabel,
  textA: c.textA ?? '',
  textBLabel: c.textBLabel,
  textB: c.textB ?? '',
});

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * Los dos paneles de texto de un capítulo. Guardado explícito: el PATCH sólo
 * lleva los campos que cambiaron, para no pisar el otro panel con una copia
 * obsoleta ni mover cientos de KB por cada guardado.
 */
export function ChapterTextPanels({ chapter, bookId }: { chapter: Chapter; bookId: string | null }) {
  const [draft, setDraft] = useState<Draft>(() => fromChapter(chapter));
  const [shown, setShown] = useState<'A' | 'B'>('A'); // sólo lo usa el CSS de móvil
  const update = useUpdateChapter(bookId);

  // Depende de chapter.id, NUNCA de chapter: el objeto cambia de identidad en
  // cada setQueryData/refetch, y si el efecto dependiera de él borraría lo
  // que el autor está escribiendo.
  useEffect(() => {
    setDraft(fromChapter(chapter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  // Contra el objeto del servidor, no contra una foto tomada al montar: tras
  // guardar, setQueryData actualiza `chapter` y `dirty` pasa a false solo.
  const dirty =
    draft.textA !== (chapter.textA ?? '') ||
    draft.textB !== (chapter.textB ?? '') ||
    draft.textALabel !== chapter.textALabel ||
    draft.textBLabel !== chapter.textBLabel;

  const save = async () => {
    const patch: ChapterPatch = {};
    if (draft.textALabel !== chapter.textALabel) patch.textALabel = draft.textALabel.trim();
    if (draft.textBLabel !== chapter.textBLabel) patch.textBLabel = draft.textBLabel.trim();
    if (draft.textA !== (chapter.textA ?? '')) patch.textA = draft.textA;
    if (draft.textB !== (chapter.textB ?? '')) patch.textB = draft.textB;
    if (Object.keys(patch).length === 0) return;
    await update.mutateAsync({ id: chapter.id, ...patch });
  };

  useUnsavedChanges({
    dirty,
    onSave: save,
    message: 'Hay cambios sin guardar en el texto del capítulo. ¿Descartarlos?',
  });

  return (
    <>
      <ErrorBanner error={update.error} />

      <div className="chapter-panel-switch">
        <button
          className="btn btn-sm"
          aria-pressed={shown === 'A'}
          onClick={() => setShown('A')}
        >
          {draft.textALabel}
        </button>
        <button
          className="btn btn-sm"
          aria-pressed={shown === 'B'}
          onClick={() => setShown('B')}
        >
          {draft.textBLabel}
        </button>
      </div>

      <div className="chapter-panels" data-panel={shown}>
        <div className="chapter-panel" data-slot="A">
          <input
            className="panel-label"
            aria-label="Rótulo del panel izquierdo"
            value={draft.textALabel}
            onChange={(e) => setDraft((d) => ({ ...d, textALabel: e.target.value }))}
          />
          <textarea
            className="textarea chapter-text"
            value={draft.textA}
            onChange={(e) => setDraft((d) => ({ ...d, textA: e.target.value }))}
          />
          <div className="panel-meta">{wordCount(draft.textA)} palabras</div>
        </div>
        <div className="chapter-panel" data-slot="B">
          <input
            className="panel-label"
            aria-label="Rótulo del panel derecho"
            value={draft.textBLabel}
            onChange={(e) => setDraft((d) => ({ ...d, textBLabel: e.target.value }))}
          />
          <textarea
            className="textarea chapter-text"
            value={draft.textB}
            onChange={(e) => setDraft((d) => ({ ...d, textB: e.target.value }))}
          />
          <div className="panel-meta">{wordCount(draft.textB)} palabras</div>
        </div>
      </div>

      <div className="save-bar">
        {dirty && <span className="badge badge-dirty">Cambios sin guardar</span>}
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar texto (Ctrl+S)'}
        </button>
      </div>
    </>
  );
}
