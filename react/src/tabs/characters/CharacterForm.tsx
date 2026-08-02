import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, ErrorBanner } from '../../components/ui';
import { CHARACTER_ROLES, ROLE_LABELS, type Character } from '../../types';

// Sólo el nombre es obligatorio: hay que poder esbozar un personaje ahora y
// rellenarlo más tarde, que es como se trabaja al diseñar una novela.
const schema = z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío'),
  role: z.enum(CHARACTER_ROLES),
  age: z.string(),
  physicalDescription: z.string(),
  personality: z.string(),
  backstory: z.string(),
  personalPlot: z.string(),
  arcSummary: z.string(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

const toForm = (c?: Character | null): FormValues => ({
  name: c?.name ?? '',
  role: c?.role ?? 'SECONDARY',
  age: c?.age ?? '',
  physicalDescription: c?.physicalDescription ?? '',
  personality: c?.personality ?? '',
  backstory: c?.backstory ?? '',
  personalPlot: c?.personalPlot ?? '',
  arcSummary: c?.arcSummary ?? '',
  notes: c?.notes ?? '',
});

export function CharacterForm({
  character,
  onSubmit,
  onClose,
  pending,
  error,
}: {
  character?: Character | null;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(character) });

  return (
    <Modal
      title={character ? 'Editar personaje' : 'Nuevo personaje'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button
            type="submit"
            form="character-form"
            className="btn btn-primary"
            disabled={pending}
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <ErrorBanner error={error} />

      {/* Guardado explícito, no autoguardado: en campos de texto largo el
          autoguardado dispara escrituras a media frase y complica deshacer. */}
      <form id="character-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="field">
          <label htmlFor="name">Nombre</label>
          <input id="name" className="input" autoFocus {...register('name')} />
          {errors.name && <span className="error-text">{errors.name.message}</span>}
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="role">Rol</label>
            <select id="role" className="select" {...register('role')}>
              {CHARACTER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="age">
              Edad <span className="hint">— texto libre</span>
            </label>
            <input id="age" className="input" placeholder="unos cuarenta" {...register('age')} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="physicalDescription">Descripción física</label>
          <textarea id="physicalDescription" className="textarea" {...register('physicalDescription')} />
        </div>

        <div className="field">
          <label htmlFor="personality">Personalidad</label>
          <textarea id="personality" className="textarea" {...register('personality')} />
        </div>

        <div className="field">
          <label htmlFor="backstory">
            Historia previa <span className="hint">— qué le pasó antes de empezar el libro</span>
          </label>
          <textarea id="backstory" className="textarea" {...register('backstory')} />
        </div>

        <div className="field">
          <label htmlFor="personalPlot">
            Trama personal <span className="hint">— qué le ocurre durante el libro</span>
          </label>
          <textarea id="personalPlot" className="textarea" {...register('personalPlot')} />
        </div>

        <div className="field">
          <label htmlFor="arcSummary">
            Arco <span className="hint">— cómo cambia por dentro, en una frase</span>
          </label>
          <textarea id="arcSummary" className="textarea" {...register('arcSummary')} />
        </div>

        <div className="field">
          <label htmlFor="notes">Notas</label>
          <textarea id="notes" className="textarea" {...register('notes')} />
        </div>
      </form>
    </Modal>
  );
}
