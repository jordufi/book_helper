import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { HttpError } from './http.js';

/** Raíz donde viven los ficheros subidos. Configurable por si cambia el layout. */
export const uploadsRoot = path.resolve(process.env.UPLOADS_DIR ?? '../uploads');
export const charactersDir = path.join(uploadsRoot, 'characters');

fs.mkdirSync(charactersDir, { recursive: true });

const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export const photoUpload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, charactersDir),
    // El nombre lo genera el servidor. El del cliente es entrada no confiable:
    // puede traer "../" o caracteres que escapen del directorio.
    filename: (_req, file, cb) => {
      const ext = allowedTypes.get(file.mimetype) ?? '';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      cb(new HttpError(400, 'Formato no admitido. Usa JPG, PNG o WebP.'));
      return;
    }
    cb(null, true);
  },
});

/** URL pública a partir del nombre de fichero en disco. */
export const photoUrlFor = (filename: string) => `/uploads/characters/${filename}`;

/**
 * Borra el fichero de una photoUrl anterior. Silencioso a propósito: si el
 * fichero ya no está, el objetivo (que no quede huérfano) se cumple igual y no
 * merece tumbar la petición.
 */
export function deletePhotoFile(photoUrl: string | null | undefined): void {
  if (!photoUrl) return;

  const filename = path.basename(photoUrl);
  const target = path.join(charactersDir, filename);

  // Defensa contra path traversal: el fichero debe caer dentro de charactersDir.
  if (path.dirname(path.resolve(target)) !== path.resolve(charactersDir)) return;

  fs.rm(target, { force: true }, (err) => {
    if (err) console.warn('[upload] no se pudo borrar', target, err.message);
  });
}
