import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Storage from 'expo-sqlite/kv-store';

const SEEN_KEY = 'story-planner:tutorial-visto';

interface WalkthroughValue {
  /** Si el tutorial debe estar en pantalla ahora mismo. */
  visible: boolean;
  /** Abrirlo a mano desde Ajustes. No toca el flag guardado. */
  open: () => void;
  /** Cerrarlo por esta vez: volverá a salir en el próximo arranque. */
  close: () => void;
  /** "No mostrar de nuevo": lo cierra y lo desactiva para siempre. */
  dismissForever: () => void;
}

const WalkthroughContext = createContext<WalkthroughValue | null>(null);

/**
 * Estado del tutorial de bienvenida. Mismo patrón que `SettingsProvider`
 * (Context + `expo-sqlite/kv-store`), y va en un Context y no en un `useState`
 * de `App` porque lo tocan dos sitios muy separados: el propio tutorial y el
 * botón "Ver el tutorial otra vez" de Ajustes.
 *
 * `seen` empieza en `null` ("todavía no sabemos") a propósito, y sólo se
 * enseña el tutorial con `seen === false`. Si empezara en `false`, el
 * tutorial aparecería medio segundo en cada arranque a quien ya lo había
 * descartado, mientras se lee el storage.
 *
 * El flag sólo lo escribe "No mostrar de nuevo" (`dismissForever`): cerrar con
 * la ✕ o terminar los pasos lo oculta esta vez, pero volverá a salir al abrir
 * la app de nuevo. Es el comportamiento que se pidió — el tutorial insiste
 * hasta que el usuario dice explícitamente que no lo quiere más.
 */
export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  const [manual, setManual] = useState(false);
  const [closedThisSession, setClosedThisSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Storage.getItem(SEEN_KEY).then((stored) => {
      if (!cancelled) setSeen(stored === '1');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<WalkthroughValue>(
    () => ({
      visible: manual || (seen === false && !closedThisSession),
      open: () => setManual(true),
      close: () => {
        setManual(false);
        setClosedThisSession(true);
      },
      dismissForever: () => {
        setManual(false);
        setSeen(true);
        void Storage.setItem(SEEN_KEY, '1');
      },
    }),
    [manual, seen, closedThisSession],
  );

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthrough(): WalkthroughValue {
  const value = useContext(WalkthroughContext);
  if (!value) throw new Error('useWalkthrough debe usarse dentro de <WalkthroughProvider>');
  return value;
}
