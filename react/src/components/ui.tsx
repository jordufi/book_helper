import { useEffect, type ReactNode } from 'react';
import { ApiError } from '../api/client';

export function Avatar({
  src,
  name,
  large = false,
}: {
  src: string | null;
  name: string;
  large?: boolean;
}) {
  const cls = large ? 'avatar avatar-lg' : 'avatar';
  // Sin foto: inicial del nombre. Evita un hueco vacío en la cuadrícula.
  if (!src) return <div className={cls}>{name.trim().charAt(0).toUpperCase() || '?'}</div>;
  return <img className={cls} src={src} alt={name} />;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Bloquea el scroll del fondo mientras el modal está abierto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Borrar',
  onConfirm,
  onCancel,
  pending,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel} disabled={pending}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={pending}>
            {pending ? 'Borrando…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}

/** Muestra el mensaje de la API, incluidos los detalles de validación de zod. */
export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;

  const message = error instanceof Error ? error.message : 'Ha ocurrido un error';
  const details = error instanceof ApiError ? error.details : undefined;

  return (
    <div className="banner banner-error">
      <strong>{message}</strong>
      {details && details.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {details.map((d, i) => (
            <li key={i}>
              {d.campo}: {d.problema}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const Spinner = ({ label = 'Cargando…' }: { label?: string }) => (
  <div className="spinner">{label}</div>
);
