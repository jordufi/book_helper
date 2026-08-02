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
});

export type BookCreate = z.infer<typeof bookCreateSchema>;
export type CharacterCreate = z.infer<typeof characterCreateSchema>;
