import { useEffect, useRef, useState } from 'react';
import { registerSaveStatus, unregisterSaveStatus } from './saveStatus';

/**
 * Registra un borrador con cambios sin guardar en el estado global de
 * guardado (indicador de la cabecera, aviso al navegar/cerrar la pestaña,
 * Ctrl/Cmd+S — todo eso vive en saveStatus.ts y en SaveIndicator, no aquí).
 * Puede haber varios editores registrados a la vez: se combinan, no se pisan.
 */
export function useUnsavedChanges(opts: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void | Promise<void>;
}) {
  const { dirty, saving = false } = opts;

  // onSave cambia de identidad en cada render; si el registro dependiera de
  // ella directamente, se re-registraría sin necesidad en cada render.
  const onSaveRef = useRef(opts.onSave);
  onSaveRef.current = opts.onSave;

  const [id] = useState(() => Symbol('unsaved-changes'));

  useEffect(() => {
    registerSaveStatus(id, { dirty, saving, save: () => onSaveRef.current() });
    return () => unregisterSaveStatus(id);
  }, [id, dirty, saving]);
}
