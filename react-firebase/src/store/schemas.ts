import { z } from 'zod';
import { CHARACTER_ROLES } from '../types';

/**
 * Copia de `api/src/lib/schemas.ts`, con una única diferencia deliberada: los
 * campos que allí exigían formato `uuid()` aquí sólo exigen una cadena no
 * vacía. `newId()` genera uuid v4 casi siempre, pero tiene un último recurso
 * sin ese formato (ver `ids.ts`) para cuando `crypto` no está disponible; y en
 * este modelo de documento único no hace falta el formato en sí, sólo que la
 * referencia exista — eso lo comprueba `store.ts` al usarla, igual que el
 * `P2003` de Prisma comprobaba la clave foránea en la API.
 *
 * El resto —incluida la distinción `longText` / `longTextPatch` que evita que
 * guardar un panel de capítulo vacíe el otro— se mantiene literal: es la parte
 * más fácil de estropear si se reescribe a mano.
 */

const id = z.string().min(1, 'Id inválido');

const longText = z
  .string()
  .max(20_000)
  .nullish()
  .transform((v) => (v?.trim() ? v : null));

export const bookCreateSchema = z.object({
  title: z.string().trim().min(1, 'El título no puede estar vacío').max(200),
  author: z.string().trim().max(200).nullish().transform((v) => v || null),
  synopsis: longText,
});

export const bookUpdateSchema = bookCreateSchema.partial();

export const characterCreateSchema = z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(200),
  role: z.enum(CHARACTER_ROLES).default('SECONDARY'),
  age: z.string().trim().max(100).nullish().transform((v) => v || null),
  physicalDescription: longText,
  personality: longText,
  backstory: longText,
  personalPlot: longText,
  arcSummary: longText,
  notes: longText,
});

export const characterUpdateSchema = characterCreateSchema.partial();

export const arcStagesSchema = z.object({
  stages: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'La etapa necesita un título').max(200),
        description: longText,
      }),
    )
    .max(100),
});

export const relationshipCreateSchema = z.object({
  relatedCharacterId: id,
  type: z.string().trim().min(1, 'Indica el tipo de relación').max(100),
  description: longText,
  reciprocalType: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((v) => v || null),
});

/**
 * Ver el comentario homónimo en `api/src/lib/schemas.ts`: con la clave
 * ausente, `undefined` sobrevive como `undefined` (zod omite la clave del
 * resultado, así que el store no toca la columna); con la clave presente,
 * vacío o `null` se normaliza a `null` (se borra explícitamente).
 */
const longTextPatch = (max = 20_000) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v && v.trim() ? v : null;
    });

const CHAPTER_TEXT_MAX = 200_000;

export const chapterCreateSchema = z.object({
  title: z.string().trim().min(1, 'El capítulo necesita un título').max(200),
  synopsis: longText,
  notes: longText,
});

export const chapterUpdateSchema = z.object({
  title: z.string().trim().min(1, 'El capítulo necesita un título').max(200).optional(),
  synopsis: longTextPatch(),
  notes: longTextPatch(),
  textALabel: z.string().trim().min(1, 'El rótulo no puede estar vacío').max(60).optional(),
  textBLabel: z.string().trim().min(1, 'El rótulo no puede estar vacío').max(60).optional(),
  textA: longTextPatch(CHAPTER_TEXT_MAX),
  textB: longTextPatch(CHAPTER_TEXT_MAX),
});

export const chapterOrderSchema = z.object({ ids: z.array(id).max(500) });

export const chapterCastSchema = z.object({
  cast: z.array(z.object({ characterId: id, action: longText })).max(100),
});

export const plotEventCreateSchema = z.object({
  title: z.string().trim().min(1, 'El suceso necesita un título').max(200),
  description: longText,
});

export const plotEventUpdateSchema = z.object({
  title: z.string().trim().min(1, 'El suceso necesita un título').max(200).optional(),
  description: longTextPatch(),
});

export const plotEventOrderSchema = z.object({ ids: z.array(id).max(1000) });

export const plotPromiseCreateSchema = z.object({
  title: z.string().trim().min(1, 'La promesa necesita un título').max(200),
  description: longText,
  setupEventId: id,
  payoffEventId: id.nullish().transform((v) => v ?? null),
});

export const plotPromiseUpdateSchema = z.object({
  title: z.string().trim().min(1, 'La promesa necesita un título').max(200).optional(),
  description: longTextPatch(),
  setupEventId: id.optional(),
  payoffEventId: id.nullable().optional(),
});
