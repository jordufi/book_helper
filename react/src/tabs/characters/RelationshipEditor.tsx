import { useState } from 'react';
import { fileUrl } from '../../api/client';
import { useAddRelationship, useDeleteRelationship } from '../../api/hooks';
import { Avatar, ErrorBanner } from '../../components/ui';
import type { Character, CharacterSummary } from '../../types';

export function RelationshipEditor({
  character,
  candidates,
  bookId,
  onSelectCharacter,
}: {
  character: Character;
  candidates: CharacterSummary[];
  bookId: string | null;
  onSelectCharacter: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [relatedId, setRelatedId] = useState('');
  const [type, setType] = useState('');

  const add = useAddRelationship(bookId);
  const remove = useDeleteRelationship(bookId, character.id);

  // Uno mismo nunca es candidato; el resto sí, aunque ya exista otra relación
  // con él (A puede ser a la vez "hermano" y "rival" de B).
  const options = candidates.filter((c) => c.id !== character.id);

  const submit = async () => {
    if (!relatedId || !type.trim()) return;
    await add.mutateAsync({ id: character.id, relatedCharacterId: relatedId, type: type.trim() });
    setRelatedId('');
    setType('');
    setAdding(false);
  };

  return (
    <>
      {character.relationships.length === 0 && !adding && (
        <p className="empty-note">Sin relaciones.</p>
      )}

      {character.relationships.map((r) => (
        <div className="rel" key={r.id}>
          <Avatar src={fileUrl(r.relatedCharacter.photoUrl)} name={r.relatedCharacter.name} />
          <div className="rel-body">
            <div className="rel-type">{r.type}</div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: 0, fontWeight: 600 }}
              onClick={() => onSelectCharacter(r.relatedCharacter.id)}
            >
              {r.relatedCharacter.name}
            </button>
            {r.description && <div className="prose">{r.description}</div>}
          </div>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            onClick={() => remove.mutate(r.id)}
            disabled={remove.isPending}
            aria-label={`Quitar relación con ${r.relatedCharacter.name}`}
          >
            ✕
          </button>
        </div>
      ))}

      <ErrorBanner error={add.error ?? remove.error} />

      {adding ? (
        <div style={{ marginTop: 10 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="rel-who">Personaje</label>
              <select
                id="rel-who"
                className="select"
                value={relatedId}
                onChange={(e) => setRelatedId(e.target.value)}
              >
                <option value="">Elige…</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rel-type">Es su…</label>
              <input
                id="rel-type"
                className="input"
                placeholder="hermano, rival, mentor"
                value={type}
                onChange={(e) => setType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={submit}
              disabled={!relatedId || !type.trim() || add.isPending}
            >
              {add.isPending ? 'Añadiendo…' : 'Añadir'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-sm"
          onClick={() => setAdding(true)}
          disabled={options.length === 0}
          style={{ marginTop: 8 }}
          title={options.length === 0 ? 'Necesitas otro personaje en el libro' : undefined}
        >
          + Relación
        </button>
      )}
    </>
  );
}
