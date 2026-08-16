/** Dispara la descarga de un fichero de texto generado en el cliente. */
export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Nombre de fichero a partir de un título: sin acentos, minúsculas, con guiones. */
export function slugify(text: string): string {
  const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
  const slug = text
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'libro';
}
