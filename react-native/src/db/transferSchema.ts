import { z } from 'zod';
import { CHARACTER_ROLES } from '../types';

/**
 * Validación del JSON de un libro. Vive aparte de `transfer.ts` (que hace la
 * E/S contra SQLite) por dos motivos: aquí no se importa nada de Expo, así que
 * el schema se puede ejecutar y probar fuera del móvil; y deja claro que la
 * validación de un fichero externo es un paso propio, no un detalle del
 * insert.
 *
 * El formato es EXACTAMENTE el de `GET /api/books/:id/export` de la web, para
 * que un fichero exportado desde el portátil se importe aquí sin conversiones.
 * Sin fotos, igual que la web: son ficheros en disco, no datos portables.
 */

const longText = z
  .string()
  .max(200_000)
  .nullish()
  .transform((v) => (v?.trim() ? v : null));

/**
 * Id *dentro del fichero*: sólo sirve para que relaciones, reparto y promesas
 * se referencien entre sí en el mismo JSON. Al importar se descarta y se
 * genera uno nuevo, así que no hace falta que sea un uuid.
 */
const localId = z.string().min(1).max(200);

export const bookImportSchema = z.object({
  book: z.object({
    title: z.string().trim().min(1, 'El título no puede estar vacío').max(200),
    author: z.string().trim().max(200).nullish().transform((v) => v || null),
    synopsis: longText,
  }),
  characters: z
    .array(
      z.object({
        id: localId,
        name: z.string().trim().min(1).max(200),
        role: z.enum(CHARACTER_ROLES).default('SECONDARY'),
        age: z.string().trim().max(100).nullish().transform((v) => v || null),
        physicalDescription: longText,
        personality: longText,
        backstory: longText,
        personalPlot: longText,
        arcSummary: longText,
        notes: longText,
        arcStages: z
          .array(z.object({ title: z.string().trim().min(1).max(200), description: longText }))
          .max(100)
          .default([]),
        relationships: z
          .array(
            z.object({
              relatedCharacterId: localId,
              type: z.string().trim().min(1).max(100),
              description: longText,
            }),
          )
          .max(500)
          .default([]),
      }),
    )
    .max(500)
    .default([]),
  chapters: z
    .array(
      z.object({
        id: localId,
        title: z.string().trim().min(1).max(200),
        synopsis: longText,
        notes: longText,
        textALabel: z.string().trim().min(1).max(60).default('Borrador'),
        textBLabel: z.string().trim().min(1).max(60).default('Reescritura'),
        textA: longText,
        textB: longText,
        cast: z
          .array(z.object({ characterId: localId, action: longText }))
          .max(100)
          .default([]),
      }),
    )
    .max(1000)
    .default([]),
  plot: z
    .object({
      events: z
        .array(
          z.object({
            id: localId,
            title: z.string().trim().min(1).max(200),
            description: longText,
          }),
        )
        .max(1000)
        .default([]),
      promises: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(200),
            description: longText,
            setupEventId: localId,
            payoffEventId: localId.nullish().transform((v) => v ?? null),
          }),
        )
        .max(1000)
        .default([]),
    })
    .default({ events: [], promises: [] }),
});

export type BookImport = z.infer<typeof bookImportSchema>;
