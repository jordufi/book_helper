import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useT } from '../state/useSettings';

interface Registry {
  report: (id: symbol, dirty: boolean) => void;
}

const UnsavedContext = createContext<Registry | null>(null);

/**
 * Bloquea la salida de una pantalla mientras haya borradores sin guardar.
 *
 * Es el equivalente móvil del aviso que en la web dan `saveStatus.ts` y el
 * indicador de la cabecera. Y es un registro de VARIAS entradas por el mismo
 * motivo que allí: una ficha de capítulo tiene a la vez el reparto y el texto
 * como borradores independientes en la misma pantalla, así que un único
 * booleano sólo recordaría el último que se registró.
 *
 * Cubre el botón atrás, el gesto de deslizar y el atrás de Android (todo eso
 * pasa por `usePreventRemove`). NO cubre cambiar de pestaña —la pantalla no se
 * desmonta, así que el borrador sigue ahí— ni que el sistema mate la app.
 */
export function UnsavedChangesGuard({
  message,
  children,
}: {
  message?: string;
  children: ReactNode;
}) {
  const navigation = useNavigation();
  const i18n = useT();
  const [dirtyIds, setDirtyIds] = useState<symbol[]>([]);

  const report = useCallback((id: symbol, dirty: boolean) => {
    setDirtyIds((prev) => {
      const has = prev.includes(id);
      if (dirty === has) return prev; // sin cambio: no re-renderizar
      return dirty ? [...prev, id] : prev.filter((x) => x !== id);
    });
  }, []);

  usePreventRemove(dirtyIds.length > 0, ({ data }) => {
    Alert.alert(i18n.unsaved.alertTitle, message ?? i18n.unsaved.default, [
      { text: i18n.unsaved.keepEditing, style: 'cancel' },
      {
        text: i18n.unsaved.discard,
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const value = useMemo<Registry>(() => ({ report }), [report]);
  return <UnsavedContext.Provider value={value}>{children}</UnsavedContext.Provider>;
}

/**
 * Declara desde un editor si su borrador está sucio. Silencioso si no hay
 * ningún `UnsavedChangesGuard` por encima: así los editores se pueden montar
 * en cualquier sitio sin romper.
 */
export function useReportUnsaved(dirty: boolean): void {
  const registry = useContext(UnsavedContext);
  const [id] = useState(() => Symbol('unsaved'));

  useEffect(() => {
    registry?.report(id, dirty);
  }, [registry, id, dirty]);

  // Al desmontar deja de contar: si el editor desaparece, su borrador ya no
  // puede perderse.
  useEffect(() => {
    return () => registry?.report(id, false);
  }, [registry, id]);
}
