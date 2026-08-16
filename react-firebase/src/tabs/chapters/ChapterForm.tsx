import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, ErrorBanner } from '../../components/ui';
import type { Chapter } from '../../types';

// El texto (textA/textB) no va en este formulario: nace vacío y se edita en
// los paneles de la ficha, que guardan aparte con su propio PATCH.
const schema = z.object({
  title: z.string().trim().min(1, 'El capítulo necesita un título'),
  synopsis: z.string(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

const toForm = (c?: Chapter | null): FormValues => ({
  title: c?.title ?? '',
  synopsis: c?.synopsis ?? '',
  notes: c?.notes ?? '',
});

export function ChapterForm({
  chapter,
  onSubmit,
  onClose,
  pending,
  error,
}: {
  chapter?: Chapter | null;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(chapter) });

  return (
    <Modal
      title={chapter ? 'Editar capítulo' : 'Nuevo capítulo'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" form="chapter-form" className="btn btn-primary" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} />

      <form id="chapter-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" className="input" autoFocus {...register('title')} />
          {errors.title && <span className="error-text">{errors.title.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="synopsis">
            Sinopsis <span className="hint">— qué ocurre en el capítulo</span>
          </label>
          <textarea id="synopsis" className="textarea" {...register('synopsis')} />
        </div>

        <div className="field">
          <label htmlFor="notes">Notas</label>
          <textarea id="notes" className="textarea" {...register('notes')} />
        </div>
      </form>
    </Modal>
  );
}
