import { useRef } from 'react';
import { fileUrl } from '../../api/client';
import { useDeletePhoto, useUploadPhoto } from '../../api/hooks';
import { Avatar } from '../../components/ui';
import type { Character } from '../../types';

export function PhotoUpload({ character, bookId }: { character: Character; bookId: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto(bookId);
  const remove = useDeletePhoto(bookId);
  const busy = upload.isPending || remove.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <Avatar src={fileUrl(character.photoUrl)} name={character.name} large />

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate({ id: character.id, file });
          // Permite volver a elegir el mismo fichero tras un fallo.
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          {upload.isPending ? 'Subiendo…' : character.photoUrl ? 'Cambiar' : 'Foto'}
        </button>
        {character.photoUrl && (
          <button
            className="btn btn-sm btn-danger"
            onClick={() => remove.mutate({ id: character.id })}
            disabled={busy}
          >
            Quitar
          </button>
        )}
      </div>

      {upload.error && (
        <span className="error-text" style={{ maxWidth: 140, textAlign: 'center' }}>
          {upload.error.message}
        </span>
      )}
    </div>
  );
}
