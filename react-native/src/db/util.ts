import { randomUUID } from 'expo-crypto';

/** Id nuevo. Mismo formato que los que genera Prisma en la web (uuid v4). */
export const newId = (): string => randomUUID();

/** Marca de tiempo en el formato que guardamos: ISO-8601 en UTC. */
export const now = (): string => new Date().toISOString();

/**
 * Normaliza un texto largo: cadena vacía o en blanco cuentan como "sin
 * rellenar", igual que el helper `longText` de zod en la API. Mantenerlo
 * idéntico evita que un campo vacío se guarde a veces como '' y a veces como
 * NULL, que luego obliga a comprobar las dos cosas en cada lectura.
 */
export const text = (value: string | null | undefined): string | null =>
  value && value.trim() ? value : null;

/**
 * Aplica un patch parcial: sólo las claves REALMENTE presentes se tocan.
 *
 * Es el equivalente local de `longTextPatch` en la API, y existe por el mismo
 * motivo: en un capítulo, guardar el panel A no debe vaciar el B. `undefined`
 * significa "no enviado, no tocar"; `null` o '' significan "vaciar".
 */
export function buildUpdate(
  patch: Record<string, unknown>,
  columns: Record<string, string>,
): { sql: string; values: unknown[] } {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(columns)) {
    if (!(key in patch) || patch[key] === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(patch[key]);
  }

  return { sql: sets.join(', '), values };
}
