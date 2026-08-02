/**
 * Trama y Capítulos son placeholders a propósito: sólo deben ser seleccionables
 * y mostrar su título. No añadirles funcionalidad sin pedirlo.
 */
export function PlaceholderTab({ title, note }: { title: string; note: string }) {
  return (
    <div className="placeholder">
      <h1>{title}</h1>
      <p>{note}</p>
    </div>
  );
}
