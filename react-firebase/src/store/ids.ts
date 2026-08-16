/**
 * En la API cada id lo generaba Postgres (`gen_random_uuid()` vía Prisma). Sin
 * servidor, lo genera el cliente.
 *
 * `crypto.randomUUID()` sólo existe en contexto seguro (HTTPS o localhost), y
 * este proyecto se verifica adrede cargando la app por la IP de red
 * (`http://192.168.x.x:5173`, ver CLAUDE.md) para detectar justo este tipo de
 * fallo — ahí `randomUUID` no existe y `crypto.subtle` tampoco. Sin fallback,
 * crear cualquier cosa (un libro, un personaje…) reventaría exactamente en el
 * escenario que se comprueba.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    // Variante y versión de uuid v4 (RFC 4122).
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Último recurso, sin garantías criptográficas: sólo hace falta que no
  // colisione dentro de este documento.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
