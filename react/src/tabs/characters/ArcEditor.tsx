import { useEffect, useState } from 'react';
import { useSaveArc } from '../../api/hooks';
import { ErrorBanner } from '../../components/ui';
import type { Character } from '../../types';

interface Draft {
  title: string;
  description: string;
}

/**
 * Edita el arco como lista ordenada y lo guarda entero de una vez
 * (PUT /characters/:id/arc). La posición se deriva del orden del array, así
 * que reordenar es mover elementos y guardar.
 */
export function ArcEditor({ character, bookId }: { character: Character; bookId: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft[]>([]);
  const save = useSaveArc(bookId);

  // Al cambiar de personaje hay que descartar el borrador del anterior.
  useEffect(() => {
    setEditing(false);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  const startEditing = () => {
    setDraft(character.arcStages.map((s) => ({ title: s.title, description: s.description ?? '' })));
    setEditing(true);
  };

  const update = (i: number, patch: Partial<Draft>) =>
    setDraft((d) => d.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  const move = (i: number, delta: number) =>
    setDraft((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async () => {
    const stages = draft
      .filter((s) => s.title.trim())
      .map((s) => ({ title: s.title.trim(), description: s.description.trim() || null }));
    await save.mutateAsync({ id: character.id, stages });
    setEditing(false);
  };

  if (!editing) {
    return (
      <>
        {character.arcStages.length === 0 ? (
          <p className="empty-note">
            Sin etapas. Divide el arco en momentos: punto de partida, detonante, crisis,
            transformación.
          </p>
        ) : (
          <div className="timeline">
            {character.arcStages.map((s, i) => (
              <div className="timeline-item" key={s.id}>
                <div className="timeline-rail">
                  <div className="timeline-dot" />
                  {i < character.arcStages.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="timeline-body">
                  <div className="timeline-title">{s.title}</div>
                  {s.description && <div className="prose">{s.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-sm" onClick={startEditing} style={{ marginTop: 8 }}>
          {character.arcStages.length ? 'Editar arco' : 'Añadir etapas'}
        </button>
      </>
    );
  }

  return (
    <>
      <ErrorBanner error={save.error} />

      {draft.map((s, i) => (
        <div className="stage" key={i}>
          <div className="stage-num">{i + 1}</div>
          <div className="stage-body">
            <input
              className="input"
              placeholder="Título de la etapa"
              value={s.title}
              onChange={(e) => update(i, { title: e.target.value })}
              style={{ marginBottom: 6 }}
            />
            <textarea
              className="textarea"
              placeholder="Qué ocurre en esta etapa"
              value={s.description}
              onChange={(e) => update(i, { description: e.target.value })}
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
              aria-label="Eliminar etapa"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-sm"
          onClick={() => setDraft((d) => [...d, { title: '', description: '' }])}
        >
          + Etapa
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setEditing(false)} disabled={save.isPending}>
          Cancelar
        </button>
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar arco'}
        </button>
      </div>
    </>
  );
}
