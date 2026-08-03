import { useState } from 'react';

/**
 * Borrador local para reordenar una lista con botones ↑/↓, igual que el arco
 * de personajes. Se usa tanto para capítulos como para sucesos de trama.
 */
export function useOrderDraft<T extends { id: string }>(items: T[]) {
  const [reordering, setReordering] = useState(false);
  const [original, setOriginal] = useState<string[]>([]);
  const [draft, setDraft] = useState<T[]>([]);

  const start = () => {
    setDraft(items);
    setOriginal(items.map((i) => i.id));
    setReordering(true);
  };

  const cancel = () => setReordering(false);

  const move = (i: number, delta: number) =>
    setDraft((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const ids = draft.map((d) => d.id);
  // Sólo cuenta como cambio real si el orden difiere del que había al
  // empezar a reordenar, no por el mero hecho de haber entrado en modo edición.
  const dirty = reordering && ids.some((id, i) => id !== original[i]);

  return { reordering, draft, ids, dirty, start, cancel, move };
}
