import { useState, type ReactNode } from 'react';
import { useCharacter, useDeleteCharacter, useUpdateCharacter } from '../../api/hooks';
import { ConfirmDialog, ErrorBanner, Spinner } from '../../components/ui';
import { ROLE_LABELS, type CharacterSummary } from '../../types';
import { ArcEditor } from './ArcEditor';
import { CharacterForm } from './CharacterForm';
import { PhotoUpload } from './PhotoUpload';
import { RelationshipEditor } from './RelationshipEditor';

function Section({
  title,
  children,
  filled,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  filled?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button className="section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="chev">▶</span>
        {title}
        {/* Punto verde: la sección tiene contenido. Permite ver de un vistazo
            qué queda por rellenar con las secciones plegadas. */}
        {filled && <span className="filled" aria-label="con contenido" />}
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

const Prose = ({ text }: { text: string | null }) =>
  text ? <div className="prose">{text}</div> : <p className="empty-note">Sin rellenar.</p>;

export function CharacterDetail({
  characterId,
  bookId,
  candidates,
  onSelectCharacter,
  onDeleted,
  onBack,
}: {
  characterId: string;
  bookId: string | null;
  candidates: CharacterSummary[];
  onSelectCharacter: (id: string) => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const { data: character, isLoading, error } = useCharacter(characterId);
  const update = useUpdateCharacter(bookId);
  const remove = useDeleteCharacter(bookId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;
  if (!character) return null;

  return (
    <div className="detail">
      {/* Fuera de detail-head: en móvil la cabecera se apila y el botón debe
          quedar arriba del todo, no debajo de la foto. Oculto en escritorio. */}
      <button className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Personajes
      </button>

      <div className="detail-head">
        <PhotoUpload character={character} bookId={bookId} />

        <div className="detail-head-body">
          <h1>{character.name}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0 12px' }}>
            <span className={`badge badge-${character.role}`}>{ROLE_LABELS[character.role]}</span>
            {character.age && <span className="grid-count">{character.age}</span>}
          </div>
          <div className="detail-actions">
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Editar
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirming(true)}>
              Borrar
            </button>
          </div>
        </div>
      </div>

      <Section title="Descripción física" filled={!!character.physicalDescription}>
        <Prose text={character.physicalDescription} />
      </Section>

      <Section title="Personalidad" filled={!!character.personality}>
        <Prose text={character.personality} />
      </Section>

      <Section title="Historia previa" filled={!!character.backstory}>
        <Prose text={character.backstory} />
      </Section>

      <Section title="Trama personal" filled={!!character.personalPlot}>
        <Prose text={character.personalPlot} />
      </Section>

      <Section
        title="Arco"
        filled={!!character.arcSummary || character.arcStages.length > 0}
      >
        {character.arcSummary && (
          <div className="prose" style={{ marginBottom: 14, fontStyle: 'italic' }}>
            {character.arcSummary}
          </div>
        )}
        <ArcEditor character={character} bookId={bookId} />
      </Section>

      <Section title="Relaciones" filled={character.relationships.length > 0}>
        <RelationshipEditor
          character={character}
          candidates={candidates}
          bookId={bookId}
          onSelectCharacter={onSelectCharacter}
        />
      </Section>

      <Section title="Notas" filled={!!character.notes} defaultOpen={false}>
        <Prose text={character.notes} />
      </Section>

      {editing && (
        <CharacterForm
          character={character}
          pending={update.isPending}
          error={update.error}
          onClose={() => setEditing(false)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: character.id, ...values });
            setEditing(false);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Borrar personaje"
          message={`¿Borrar a ${character.name}? Se perderán su arco y sus relaciones.`}
          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await remove.mutateAsync(character.id);
            setConfirming(false);
            onDeleted();
          }}
        />
      )}
    </div>
  );
}
