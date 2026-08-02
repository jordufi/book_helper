import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, ErrorBanner } from '../../components/ui';
import type { PlotEvent, PlotPromise } from '../../types';

const schema = z.object({
  title: z.string().trim().min(1, 'La promesa necesita un título'),
  description: z.string(),
  setupEventId: z.string().min(1, 'Elige dónde se siembra'),
  payoffEventId: z.string(), // '' = pendiente; se convierte a null antes de enviar
});

type FormValues = z.infer<typeof schema>;

const toForm = (p: PlotPromise | undefined, defaultSetupEventId: string): FormValues => ({
  title: p?.title ?? '',
  description: p?.description ?? '',
  setupEventId: p?.setupEventId ?? defaultSetupEventId,
  payoffEventId: p?.payoffEventId ?? '',
});

export function PromiseForm({
  promise,
  events,
  defaultSetupEventId = '',
  onSubmit,
  onClose,
  pending,
  error,
}: {
  promise?: PlotPromise;
  events: PlotEvent[];
  defaultSetupEventId?: string;
  onSubmit: (values: { title: string; description: string; setupEventId: string; payoffEventId: string | null }) => void;
  onClose: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(promise, defaultSetupEventId),
  });

  return (
    <Modal
      title={promise ? 'Editar promesa' : 'Nueva promesa'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" form="promise-form" className="btn btn-primary" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} />

      <form
        id="promise-form"
        onSubmit={handleSubmit((values) =>
          // El <select> devuelve '', no null: convertir antes de mutar o el
          // backend rechaza '' como uuid inválido.
          onSubmit({ ...values, payoffEventId: values.payoffEventId || null }),
        )}
      >
        <div className="field">
          <label htmlFor="title">Título</label>
          <input id="title" className="input" autoFocus {...register('title')} />
          {errors.title && <span className="error-text">{errors.title.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="description">Descripción</label>
          <textarea id="description" className="textarea" {...register('description')} />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="setupEventId">Se siembra en</label>
            <select id="setupEventId" className="select" {...register('setupEventId')}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.position + 1} · {e.title}
                </option>
              ))}
            </select>
            {errors.setupEventId && <span className="error-text">{errors.setupEventId.message}</span>}
          </div>
          <div className="field">
            <label htmlFor="payoffEventId">Se paga en</label>
            <select id="payoffEventId" className="select" {...register('payoffEventId')}>
              <option value="">— Pendiente —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.position + 1} · {e.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
