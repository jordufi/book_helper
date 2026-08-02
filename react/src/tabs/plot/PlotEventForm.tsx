import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, ErrorBanner } from '../../components/ui';
import type { PlotEvent } from '../../types';

const schema = z.object({
  title: z.string().trim().min(1, 'El suceso necesita un título'),
  description: z.string(),
});

type FormValues = z.infer<typeof schema>;

const toForm = (e?: PlotEvent | null): FormValues => ({
  title: e?.title ?? '',
  description: e?.description ?? '',
});

export function PlotEventForm({
  event,
  onSubmit,
  onClose,
  pending,
  error,
}: {
  event?: PlotEvent | null;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(event) });

  return (
    <Modal
      title={event ? 'Editar suceso' : 'Nuevo suceso'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" form="plot-event-form" className="btn btn-primary" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} />

      <form id="plot-event-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" className="input" autoFocus {...register('title')} />
          {errors.title && <span className="error-text">{errors.title.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="description">Descripción</label>
          <textarea id="description" className="textarea" {...register('description')} />
        </div>
      </form>
    </Modal>
  );
}
