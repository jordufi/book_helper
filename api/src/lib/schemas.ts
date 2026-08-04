import { z } from 'zod';

export const characterRoles = ['PROTAGONIST', 'ANTAGONIST', 'SECONDARY', 'EXTRA'] as const;

/** Campo de texto largo: cadena vacía y null son lo mismo (campo sin rellenar). */
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
  // Único campo obligatorio: hay que poder esbozar un personaje y rellenarlo luego.
  name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(200),
  role: z.enum(characterRoles).default('SECONDARY'),
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
  relatedCharacterId: z.string().uuid('Id de personaje inválido'),
  type: z.string().trim().min(1, 'Indica el tipo de relación').max(100),
  description: longText,
  // Opt-in: si se envía, crea también la relación inversa (el otro personaje
  // hacia este) con este texto. Ausente = sólo se crea el sentido pedido; las
  // relaciones siguen siendo dirigidas por defecto (ver CLAUDE.md).
  reciprocalType: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((v) => v || null),
});

export type BookCreate = z.infer<typeof bookCreateSchema>;
export type CharacterCreate = z.infer<typeof characterCreateSchema>;

// --- Capítulos ---------------------------------------------------------------

/**
 * Texto largo dentro de un PATCH. Hace falta un helper distinto de longText
 * porque longText es .nullish().transform(): con la clave ausente el transform
 * devuelve null, zod lo escribe en la salida y Prisma BORRA la columna. En un
 * capítulo eso significa que guardar un panel vaciaría el otro.
 *
 * Aquí `undefined` sobrevive como `undefined` y zod omite la clave del
 * resultado, así que Prisma no toca la columna. `null` o cadena en blanco sí
 * la borran, que es lo que el cliente pide explícitamente.
 */
const longTextPatch = (max = 20_000) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined; // no enviado: no se toca
      return v && v.trim() ? v : null; // enviado vacío: se borra
    });

/** Un capítulo entero cabe aquí; longText (20 k) se queda corto. */
const CHAPTER_TEXT_MAX = 200_000;

export const chapterCreateSchema = z.object({
  title: z.string().trim().min(1, 'El capítulo necesita un título').max(200),
  synopsis: longText,
  notes: longText,
});
// El texto NO va en el alta: un capítulo nuevo nace vacío y así el POST nunca
// mueve un cuerpo grande.

export const chapterUpdateSchema = z.object({
  title: z.string().trim().min(1, 'El capítulo necesita un título').max(200).optional(),
  synopsis: longTextPatch(),
  notes: longTextPatch(),
  // Los rótulos son NOT NULL en BD: se pueden cambiar, no vaciar.
  textALabel: z.string().trim().min(1, 'El rótulo no puede estar vacío').max(60).optional(),
  textBLabel: z.string().trim().min(1, 'El rótulo no puede estar vacío').max(60).optional(),
  textA: longTextPatch(CHAPTER_TEXT_MAX),
  textB: longTextPatch(CHAPTER_TEXT_MAX),
});

export const chapterOrderSchema = z.object({
  ids: z.array(z.string().uuid('Id de capítulo inválido')).max(500),
});

export const chapterCastSchema = z.object({
  cast: z
    .array(
      z.object({
        characterId: z.string().uuid('Id de personaje inválido'),
        action: longText, // se envía siempre entero: aquí longText es correcto
      }),
    )
    .max(100),
});

// --- Trama ---------------------------------------------------------------------

export const plotEventCreateSchema = z.object({
  title: z.string().trim().min(1, 'El suceso necesita un título').max(200),
  description: longText,
});

export const plotEventUpdateSchema = z.object({
  title: z.string().trim().min(1, 'El suceso necesita un título').max(200).optional(),
  description: longTextPatch(),
});

export const plotEventOrderSchema = z.object({
  ids: z.array(z.string().uuid('Id de suceso inválido')).max(1000),
});

export const plotPromiseCreateSchema = z.object({
  title: z.string().trim().min(1, 'La promesa necesita un título').max(200),
  description: longText,
  setupEventId: z.string().uuid('Id de suceso inválido'),
  // Ausente o null = promesa pendiente, que es el caso normal al crearla.
  payoffEventId: z
    .string()
    .uuid('Id de suceso inválido')
    .nullish()
    .transform((v) => v ?? null),
});

export const plotPromiseUpdateSchema = z.object({
  title: z.string().trim().min(1, 'La promesa necesita un título').max(200).optional(),
  description: longTextPatch(),
  setupEventId: z.string().uuid('Id de suceso inválido').optional(),
  // Sin transform a propósito: ausente = no tocar; null explícito = volver a
  // pendiente. Es justo la distinción que necesita "desmarcar como pagada".
  payoffEventId: z.string().uuid('Id de suceso inválido').nullable().optional(),
});

// --- Import/export de libro completo ------------------------------------------

/**
 * Id *dentro del fichero*, no de la BD: sólo sirve para que relaciones,
 * reparto y promesas se referencien entre sí en el mismo JSON exportado. No
 * hace falta que sea un uuid — al importar se descarta entero y se generan
 * ids nuevos, remapeando estas referencias.
 */
const localId = z.string().min(1).max(200);

const arcStageImportSchema = z.object({
  title: z.string().trim().min(1, 'La etapa necesita un título').max(200),
  description: longText,
});

const relationshipImportSchema = z.object({
  relatedCharacterId: localId,
  type: z.string().trim().min(1, 'Indica el tipo de relación').max(100),
  description: longText,
});

const characterImportSchema = z.object({
  id: localId,
  name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(200),
  role: z.enum(characterRoles).default('SECONDARY'),
  age: z.string().trim().max(100).nullish().transform((v) => v || null),
  physicalDescription: longText,
  personality: longText,
  backstory: longText,
  personalPlot: longText,
  arcSummary: longText,
  notes: longText,
  arcStages: z.array(arcStageImportSchema).max(100).default([]),
  relationships: z.array(relationshipImportSchema).max(500).default([]),
});

const chapterCastImportSchema = z.object({
  characterId: localId,
  action: longText,
});

const chapterImportSchema = z.object({
  id: localId,
  title: z.string().trim().min(1, 'El capítulo necesita un título').max(200),
  synopsis: longText,
  notes: longText,
  textALabel: z.string().trim().min(1).max(60).default('Borrador'),
  textBLabel: z.string().trim().min(1).max(60).default('Reescritura'),
  textA: z
    .string()
    .max(CHAPTER_TEXT_MAX)
    .nullish()
    .transform((v) => (v?.trim() ? v : null)),
  textB: z
    .string()
    .max(CHAPTER_TEXT_MAX)
    .nullish()
    .transform((v) => (v?.trim() ? v : null)),
  cast: z.array(chapterCastImportSchema).max(100).default([]),
});

const plotEventImportSchema = z.object({
  id: localId,
  title: z.string().trim().min(1, 'El suceso necesita un título').max(200),
  description: longText,
});

const plotPromiseImportSchema = z.object({
  title: z.string().trim().min(1, 'La promesa necesita un título').max(200),
  description: longText,
  setupEventId: localId,
  payoffEventId: localId.nullish().transform((v) => v ?? null),
});

/**
 * Sin fotos a propósito (ver CLAUDE.md): son ficheros en ./uploads, no datos
 * portables en un JSON. `book`, `characters`, `chapters` y `plot` con
 * `.default([])`/objeto por defecto para que un JSON parcial (p.ej. sólo
 * personajes) no rompa la validación.
 */
export const bookImportSchema = z.object({
  book: z.object({
    title: z.string().trim().min(1, 'El título no puede estar vacío').max(200),
    author: z.string().trim().max(200).nullish().transform((v) => v || null),
    synopsis: longText,
  }),
  characters: z.array(characterImportSchema).max(500).default([]),
  chapters: z.array(chapterImportSchema).max(1000).default([]),
  plot: z
    .object({
      events: z.array(plotEventImportSchema).max(1000).default([]),
      promises: z.array(plotPromiseImportSchema).max(1000).default([]),
    })
    .default({ events: [], promises: [] }),
});
