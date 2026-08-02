import { useState } from 'react';
import { fileUrl } from '../../api/client';
import { useCharacters, useCreateCharacter } from '../../api/hooks';
import { Avatar, ErrorBanner, Spinner } from '../../components/ui';
import { ROLE_LABELS, type CharacterSummary } from '../../types';
import { CharacterDetail } from './CharacterDetail';
import { CharacterForm } from './CharacterForm';

function CharacterCard({
  character,
  active,
  onClick,
}: {
  character: CharacterSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="character-card" aria-current={active} onClick={onClick}>
      <Avatar src={fileUrl(character.photoUrl)} name={character.name} />
      <div className="character-card-body">
        <div className="character-card-name">{character.name}</div>
        <div className="character-card-meta">
          <span className={`badge badge-${character.role}`}>{ROLE_LABELS[character.role]}</span>
          {character.age && ` · ${character.age}`}
        </div>
      </div>
    </button>
  );
}

export function CharactersTab({
  bookId,
  characterId,
  onSelect,
}: {
  bookId: string | null;
  characterId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data: characters, isLoading, error } = useCharacters(bookId);
  const create = useCreateCharacter(bookId);
  const [creating, setCreating] = useState(false);

  if (!bookId) {
    return (
      <div className="placeholder">
        <h1>Sin libro</h1>
        <p>Crea un libro arriba para empezar a diseñar sus personajes.</p>
      </div>
    );
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;

  const list = characters ?? [];
  // En móvil sólo cabe un panel: la lista o la ficha. Lo decide el CSS.
  const view = characterId ? 'detail' : 'list';

  return (
    <div className="characters-layout" data-view={view}>
      <div className="grid-panel">
        <div className="grid-head">
          <span className="grid-count">
            {list.length} {list.length === 1 ? 'personaje' : 'personajes'}
          </span>
          <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
            + Personaje
          </button>
        </div>

        {list.length === 0 ? (
          <p className="empty-note">Todavía no hay personajes en este libro.</p>
        ) : (
          <div className="character-list">
            {list.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                active={c.id === characterId}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="detail-panel">
        {characterId ? (
          <CharacterDetail
            characterId={characterId}
            bookId={bookId}
            candidates={list}
            onSelectCharacter={onSelect}
            onDeleted={() => onSelect(null)}
            onBack={() => onSelect(null)}
          />
        ) : (
          <div className="placeholder">
            <h2>Ningún personaje seleccionado</h2>
            <p>Elige uno de la lista o crea el primero.</p>
          </div>
        )}
      </div>

      {creating && (
        <CharacterForm
          pending={create.isPending}
          error={create.error}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const character = await create.mutateAsync(values);
            setCreating(false);
            onSelect(character.id);
          }}
        />
      )}
    </div>
  );
}
