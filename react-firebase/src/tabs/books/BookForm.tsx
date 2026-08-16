import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, ErrorBanner } from '../../components/ui';
import type { Book } from '../../types';

const schema = z.object({
  title: z.string().trim().min(1, 'El título no puede estar vacío'),
  author: z.string(),
  synopsis: z.string(),
});

type FormValues = z.infer<typeof schema>;

const toForm = (b?: Book | null): FormValues => ({
  title: b?.title ?? '',
  author: b?.author ?? '',
  synopsis: b?.synopsis ?? '',
});

export function BookForm({
  book,
  onSubmit,
  onClose,
  pending,
  error,
}: {
  book?: Book | null;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(book) });

  return (
    <Modal
      title={book ? 'Editar libro' : 'Nuevo libro'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" form="book-form" className="btn btn-primary" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} />

      <form id="book-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" className="input" autoFocus {...register('title')} />
          {errors.title && <span className="error-text">{errors.title.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="author">Autor</label>
          <input id="author" className="input" {...register('author')} />
        </div>

        <div className="field">
          <label htmlFor="synopsis">Sinopsis</label>
          <textarea id="synopsis" className="textarea" {...register('synopsis')} />
        </div>
      </form>
    </Modal>
  );
}
