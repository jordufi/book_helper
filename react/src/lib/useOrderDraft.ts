import { useState } from 'react';

/**
 * Borrador local para reordenar una lista con botones ↑/↓, igual que el arco
 * de personajes. Se usa tanto para capítulos como para sucesos de trama.
 */
export function useOrderDraft<T extends { id: string }>(items: T[]) {
  const [reordering, setReordering] = useState(false);
  const [draft, setDraft] = useState<T[]>([]);

  const start = () => {
    setDraft(items);
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

  return { reordering, draft, ids: draft.map((d) => d.id), start, cancel, move };
}
