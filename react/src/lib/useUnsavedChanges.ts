import { useEffect, useRef } from 'react';
import { setNavigationGuard } from './useRoute';

/**
 * Junta las tres piezas de "guardado explícito con aviso": bloquear la
 * navegación interna (tabs, selección de otro elemento), avisar al cerrar la
 * pestaña, y guardar con Ctrl/Cmd+S. No cubre el botón Atrás del navegador
 * (ver el comentario de setNavigationGuard en useRoute.ts).
 */
export function useUnsavedChanges(opts: {
  dirty: boolean;
  onSave: () => void | Promise<void>;
  message?: string;
}) {
  const { dirty, message = 'Hay cambios sin guardar. ¿Descartarlos?' } = opts;

  // onSave cambia de identidad en cada render; si el listener de teclado
  // dependiera de ella directamente, se re-registraría continuamente.
  const onSaveRef = useRef(opts.onSave);
  onSaveRef.current = opts.onSave;

  useEffect(() => {
    setNavigationGuard(() => !dirty || window.confirm(message));
    return () => setNavigationGuard(null);
  }, [dirty, message]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) void onSaveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirty]);
}
