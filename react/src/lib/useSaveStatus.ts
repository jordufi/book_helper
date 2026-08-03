import { useSyncExternalStore } from 'react';
import { getSaveStatusSnapshot, subscribeSaveStatus } from './saveStatus';

/** Estado combinado de todos los editores con cambios sin guardar. */
export function useSaveStatus() {
  return useSyncExternalStore(subscribeSaveStatus, getSaveStatusSnapshot);
}
