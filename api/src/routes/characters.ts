import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { assertBookExists } from '../lib/books.js';
import { HttpError, asyncHandler, notFound } from '../lib/http.js';
import {
  arcStagesSchema,
  characterCreateSchema,
  characterUpdateSchema,
  relationshipCreateSchema,
} from '../lib/schemas.js';
import { deletePhotoFile, photoUpload, photoUrlFor } from '../lib/upload.js';

/** Detalle: incluye arco y relaciones ya resueltas para evitar peticiones en cascada. */
const detailInclude = {
  arcStages: { orderBy: { position: 'asc' } },
  relationships: {
    include: {
      relatedCharacter: { select: { id: true, name: true, photoUrl: true, role: true } },
    },
  },
} as const;

async function getCharacterOrThrow(id: string) {
  const character = await prisma.character.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!character) throw notFound('Personaje');
  return character;
}

// --- Anidadas bajo un libro ------------------------------------------------

export const bookCharactersRouter = Router({ mergeParams: true });

bookCharactersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    await assertBookExists(bookId);

    // Versión ligera, sin arco ni relaciones: alimenta una cuadrícula de tarjetas.
    const characters = await prisma.character.findMany({
      where: { bookId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        role: true,
        age: true,
        photoUrl: true,
        arcSummary: true,
        updatedAt: true,
      },
    });
    res.json(characters);
  }),
);

bookCharactersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const data = characterCreateSchema.parse(req.body);
    await assertBookExists(bookId);

    const character = await prisma.character.create({
      data: { ...data, bookId },
      include: detailInclude,
    });
    res.status(201).json(character);
  }),
);

// --- Por id de personaje ---------------------------------------------------

export const charactersRouter = Router();

charactersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await getCharacterOrThrow(req.params.id));
  }),
);

charactersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = characterUpdateSchema.parse(req.body);
    await prisma.character.update({ where: { id: req.params.id }, data });
    res.json(await getCharacterOrThrow(req.params.id));
  }),
);

charactersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const character = await prisma.character.findUnique({
      where: { id: req.params.id },
      select: { photoUrl: true },
    });
    if (!character) throw notFound('Personaje');

    await prisma.character.delete({ where: { id: req.params.id } });
    deletePhotoFile(character.photoUrl);
    res.status(204).end();
  }),
);

// --- Arco ------------------------------------------------------------------

/**
 * Reemplaza la lista entera en vez de exponer CRUD por etapa: el frontend
 * reordena con drag & drop y guarda el resultado. Hacerlo por elemento
 * obligaría a sincronizar `position` con varias peticiones y a lidiar con
 * estados intermedios inconsistentes.
 */
charactersRouter.put(
  '/:id/arc',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { stages } = arcStagesSchema.parse(req.body);

    const exists = await prisma.character.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Personaje');

    // En transacción: si falla la inserción, no queremos haber borrado el arco.
    await prisma.$transaction([
      prisma.characterArcStage.deleteMany({ where: { characterId: id } }),
      prisma.characterArcStage.createMany({
        data: stages.map((stage, position) => ({ ...stage, characterId: id, position })),
      }),
    ]);

    res.json(await getCharacterOrThrow(id));
  }),
);

// --- Relaciones ------------------------------------------------------------

charactersRouter.post(
  '/:id/relationships',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reciprocalType, ...data } = relationshipCreateSchema.parse(req.body);

    if (data.relatedCharacterId === id) {
      throw new HttpError(400, 'Un personaje no puede relacionarse consigo mismo');
    }

    const [subject, object] = await Promise.all([
      prisma.character.findUnique({ where: { id }, select: { bookId: true } }),
      prisma.character.findUnique({
        where: { id: data.relatedCharacterId },
        select: { bookId: true },
      }),
    ]);

    if (!subject) throw notFound('Personaje');
    if (!object) throw notFound('Personaje relacionado');
    if (subject.bookId !== object.bookId) {
      throw new HttpError(400, 'Los dos personajes deben pertenecer al mismo libro');
    }

    if (reciprocalType) {
      // Opt-in: además de A -> B, crea B -> A con su propio texto (p.ej.
      // "hermano" / "hermana"). En transacción: si la inversa choca con una
      // relación ya existente (P2002), tampoco se crea la primera — mejor
      // que dejar sólo un sentido creado a medias.
      await prisma.$transaction([
        prisma.characterRelationship.create({ data: { ...data, characterId: id } }),
        prisma.characterRelationship.create({
          data: {
            characterId: data.relatedCharacterId,
            relatedCharacterId: id,
            type: reciprocalType,
            description: null,
          },
        }),
      ]);
    } else {
      await prisma.characterRelationship.create({ data: { ...data, characterId: id } });
    }

    res.status(201).json(await getCharacterOrThrow(id));
  }),
);

export const relationshipsRouter = Router();

relationshipsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.characterRelationship.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

// --- Foto ------------------------------------------------------------------

charactersRouter.post(
  '/:id/photo',
  photoUpload.single('photo'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.file) throw new HttpError(400, 'No se recibió ninguna imagen');

    const current = await prisma.character.findUnique({
      where: { id },
      select: { photoUrl: true },
    });

    if (!current) {
      // El personaje no existe: el fichero ya está en disco, hay que retirarlo.
      deletePhotoFile(photoUrlFor(req.file.filename));
      throw notFound('Personaje');
    }

    await prisma.character.update({
      where: { id },
      data: { photoUrl: photoUrlFor(req.file.filename) },
    });

    // La anterior sólo se borra tras confirmar la nueva en BD.
    deletePhotoFile(current.photoUrl);

    res.json(await getCharacterOrThrow(id));
  }),
);

charactersRouter.delete(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const current = await prisma.character.findUnique({
      where: { id },
      select: { photoUrl: true },
    });
    if (!current) throw notFound('Personaje');

    await prisma.character.update({ where: { id }, data: { photoUrl: null } });
    deletePhotoFile(current.photoUrl);

    res.json(await getCharacterOrThrow(id));
  }),
);
