import { useEffect, useState } from 'react';
import { fileUrl } from '../../api/client';
import { useSaveChapterCast } from '../../api/hooks';
import { Avatar, ErrorBanner, Prose } from '../../components/ui';
import { useUnsavedChanges } from '../../lib/useUnsavedChanges';
import { ROLE_LABELS, type Chapter, type CharacterSummary } from '../../types';

interface Draft {
  characterId: string;
  action: string;
}

/**
 * Mezcla de ArcEditor (borrador local + guardado entero con PUT, la posición
 * se deriva del índice del array) y RelationshipEditor (alta con un select que
 * excluye a quien ya está, para no depender del 400 del servidor).
 */
export function ChapterCastEditor({
  chapter,
  candidates,
  bookId,
}: {
  chapter: Chapter;
  candidates: CharacterSummary[];
  bookId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft[]>([]);
  const save = useSaveChapterCast(bookId);

  // Al cambiar de capítulo hay que descartar el borrador del anterior.
  useEffect(() => {
    setEditing(false);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  const byId = new Map(candidates.map((c) => [c.id, c]));

  const startEditing = () => {
    setDraft(chapter.cast.map((entry) => ({ characterId: entry.characterId, action: entry.action ?? '' })));
    setEditing(true);
  };

  const update = (i: number, patch: Partial<Draft>) =>
    setDraft((d) => d.map((e, j) => (i === j ? { ...e, ...patch } : e)));

  const move = (i: number, delta: number) =>
    setDraft((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async () => {
    const cast = draft.map((e) => ({ characterId: e.characterId, action: e.action.trim() || null }));
    await save.mutateAsync({ id: chapter.id, cast });
    setEditing(false);
  };

  const original: Draft[] = chapter.cast.map((entry) => ({ characterId: entry.characterId, action: entry.action ?? '' }));
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(original);
  useUnsavedChanges({ dirty, saving: save.isPending, onSave: submit });

  const options = candidates.filter((c) => !draft.some((e) => e.characterId === c.id));

  if (!editing) {
    return (
      <>
        {chapter.cast.length === 0 ? (
          <p className="empty-note">Nadie asignado. Añade quién sale y qué hace.</p>
        ) : (
          chapter.cast.map((entry) => (
            <div className="rel" key={entry.id}>
              <Avatar src={fileUrl(entry.character.photoUrl)} name={entry.character.name} />
              <div className="rel-body">
                <div className="rel-type">{ROLE_LABELS[entry.character.role]}</div>
                <strong>{entry.character.name}</strong>
                <Prose text={entry.action} />
              </div>
            </div>
          ))
        )}
        <button className="btn btn-sm" onClick={startEditing} style={{ marginTop: 8 }}>
          {chapter.cast.length ? 'Editar reparto' : 'Añadir reparto'}
        </button>
      </>
    );
  }

  return (
    <>
      <ErrorBanner error={save.error} />

      {draft.map((entry, i) => {
        const character = byId.get(entry.characterId);
        return (
          <div className="stage" key={entry.characterId}>
            <Avatar src={fileUrl(character?.photoUrl ?? null)} name={character?.name ?? '?'} />
            <div className="stage-body">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{character?.name ?? 'Personaje'}</div>
              <textarea
                className="textarea"
                placeholder="Qué hace en este capítulo"
                value={entry.action}
                onChange={(e) => update(i, { action: e.target.value })}
                style={{ minHeight: 56 }}
              />
            </div>
            <div className="stage-ctrl">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => move(i, 1)}
                disabled={i === draft.length - 1}
                aria-label="Bajar"
              >
                ↓
              </button>
              <button
                className="btn btn-ghost btn-sm btn-danger"
                onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                aria-label="Quitar del reparto"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      <div className="row" style={{ marginTop: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <select
            className="select"
            value=""
            disabled={options.length === 0}
            title={options.length === 0 ? 'No quedan personajes del libro por añadir' : undefined}
            onChange={(e) => {
              if (e.target.value) setDraft((d) => [...d, { characterId: e.target.value, action: '' }]);
            }}
          >
            <option value="">+ Añadir personaje…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setEditing(false)} disabled={save.isPending}>
          Cancelar
        </button>
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar reparto'}
        </button>
      </div>
    </>
  );
}
