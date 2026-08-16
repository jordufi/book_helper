import { useEffect, useRef } from 'react';
import { useSaveStatus } from '../lib/useSaveStatus';

/**
 * Indicador de guardado en la cabecera: si todo lo que hay abierto (arco,
 * reparto, texto de capítulo, reordenamientos…) está guardado o no, más un
 * botón para guardarlo todo. También es el único sitio que escucha Ctrl/Cmd+S
 * y el cierre de pestaña — antes cada editor tenía su propio listener; con
 * varios editores abiertos a la vez eso disparaba N veces el mismo atajo.
 */
export function SaveIndicator() {
  const status = useSaveStatus();
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!status.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status.dirty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (statusRef.current.dirty) void statusRef.current.saveAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (status.saving) {
    return (
      <div className="save-indicator" data-state="saving">
        <span className="save-dot" />
        Guardando…
      </div>
    );
  }

  if (status.dirty) {
    return (
      <div className="save-indicator" data-state="dirty">
        <span className="save-dot" />
        <span>Cambios sin guardar</span>
        <button className="btn btn-sm btn-primary" onClick={() => void status.saveAll()}>
          Guardar (Ctrl+S)
        </button>
      </div>
    );
  }

  return (
    <div className="save-indicator" data-state="saved">
      <span className="save-dot" />
      Todo guardado
    </div>
  );
}
