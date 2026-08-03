export interface SaveStatusEntry {
  dirty: boolean;
  saving: boolean;
  save: () => void | Promise<void>;
}

export interface SaveStatusSnapshot {
  dirty: boolean;
  saving: boolean;
  saveAll: () => Promise<void>;
}

/**
 * Registro global de "borradores con cambios sin guardar" (arco de personaje,
 * reparto de capítulo, texto de capítulo, reordenamientos…). Puede haber más
 * de uno a la vez — p.ej. el reparto y el texto de un mismo capítulo están en
 * la misma pantalla — así que se combinan en vez de pisarse como haría un
 * singleton. Sirve tanto para el indicador de la cabecera como para el aviso
 * al navegar o cerrar la pestaña.
 */
const entries = new Map<symbol, SaveStatusEntry>();
const listeners = new Set<() => void>();

function computeSnapshot(): SaveStatusSnapshot {
  const dirtyEntries = [...entries.values()].filter((e) => e.dirty);
  return {
    dirty: dirtyEntries.length > 0,
    saving: dirtyEntries.some((e) => e.saving),
    saveAll: async () => {
      await Promise.all(dirtyEntries.map((e) => e.save()));
    },
  };
}

let snapshot = computeSnapshot();

function recompute() {
  snapshot = computeSnapshot();
  listeners.forEach((l) => l());
}

export function registerSaveStatus(id: symbol, entry: SaveStatusEntry) {
  entries.set(id, entry);
  recompute();
}

export function unregisterSaveStatus(id: symbol) {
  entries.delete(id);
  recompute();
}

export function subscribeSaveStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSaveStatusSnapshot() {
  return snapshot;
}

/**
 * Usado por useRoute.ts antes de navegar: si hay algo sin guardar en
 * cualquier editor abierto, confirma con el usuario en vez de descartarlo en
 * silencio.
 */
export function confirmDiscardUnsaved(): boolean {
  if (!snapshot.dirty) return true;
  return window.confirm('Hay cambios sin guardar. ¿Seguro que quieres salir sin guardarlos?');
}
