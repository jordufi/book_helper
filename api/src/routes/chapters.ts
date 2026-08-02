import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError, asyncHandler, notFound } from '../lib/http.js';
import {
  chapterCastSchema,
  chapterCreateSchema,
  chapterOrderSchema,
  chapterUpdateSchema,
} from '../lib/schemas.js';

/** Versión ligera para la lista: SIN el texto, que puede pesar cientos de KB. */
const summarySelect = {
  id: true,
  bookId: true,
  position: true,
  title: true,
  synopsis: true,
  updatedAt: true,
  _count: { select: { cast: true } },
} as const;

const chapterDetailInclude = {
  cast: {
    orderBy: { position: 'asc' },
    include: {
      character: { select: { id: true, name: true, photoUrl: true, role: true } },
    },
  },
} as const;

async function getChapterOrThrow(id: string) {
  const chapter = await prisma.chapter.findUnique({ where: { id }, include: chapterDetailInclude });
  if (!chapter) throw notFound('Capítulo');
  return chapter;
}

// --- Anidadas bajo un libro --------------------------------------------------

export const bookChaptersRouter = Router({ mergeParams: true });

bookChaptersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const chapters = await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { position: 'asc' },
      select: summarySelect,
    });
    res.json(chapters);
  }),
);

bookChaptersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const data = chapterCreateSchema.parse(req.body);

    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!book) throw notFound('Libro');

    // _max y no count: los borrados dejan huecos en la numeración.
    const { _max } = await prisma.chapter.aggregate({
      where: { bookId },
      _max: { position: true },
    });
    const position = (_max.position ?? -1) + 1;

    const chapter = await prisma.chapter.create({
      data: { ...data, bookId, position },
      include: chapterDetailInclude,
    });
    res.status(201).json(chapter);
  }),
);

/**
 * Reordena la lista entera de golpe (igual que PUT /characters/:id/arc), pero
 * validando que el cliente mande exactamente el conjunto de capítulos del
 * libro: una lista obsoleta reordenaría en silencio con datos incompletos.
 * Declarada antes que cualquier ruta /:algo por si se añaden después.
 */
bookChaptersRouter.put(
  '/order',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const { ids } = chapterOrderSchema.parse(req.body);

    const current = await prisma.chapter.findMany({ where: { bookId }, select: { id: true } });
    const currentIds = new Set(current.map((c) => c.id));
    const uniqueIds = new Set(ids);

    if (ids.length !== currentIds.size || uniqueIds.size !== ids.length || ids.some((id) => !currentIds.has(id))) {
      throw new HttpError(400, 'La lista de orden debe contener exactamente los capítulos del libro');
    }

    await prisma.$transaction(
      ids.map((id, position) => prisma.chapter.update({ where: { id }, data: { position } })),
    );

    const chapters = await prisma.chapter.findMany({
      where: { bookId },
      orderBy: { position: 'asc' },
      select: summarySelect,
    });
    res.json(chapters);
  }),
);

// --- Por id de capítulo -------------------------------------------------------

export const chaptersRouter = Router();

chaptersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await getChapterOrThrow(req.params.id));
  }),
);

chaptersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = chapterUpdateSchema.parse(req.body);
    await prisma.chapter.update({ where: { id: req.params.id }, data });
    res.json(await getChapterOrThrow(req.params.id));
  }),
);

chaptersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const exists = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!exists) throw notFound('Capítulo');

    await prisma.chapter.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

// --- Reparto -------------------------------------------------------------------

/**
 * Reemplaza la lista entera, igual que el arco de personajes: el reparto es
 * corto y el frontend ya lo tiene entero en el borrador local. `position` se
 * deriva del índice del array.
 */
chaptersRouter.put(
  '/:id/cast',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { cast } = chapterCastSchema.parse(req.body);

    const chapter = await prisma.chapter.findUnique({ where: { id }, select: { bookId: true } });
    if (!chapter) throw notFound('Capítulo');

    const ids = cast.map((c) => c.characterId);
    if (new Set(ids).size !== ids.length) {
      throw new HttpError(400, 'Un personaje no puede aparecer dos veces en el mismo capítulo');
    }

    if (ids.length > 0) {
      const found = await prisma.character.findMany({
        where: { id: { in: ids }, bookId: chapter.bookId },
        select: { id: true },
      });
      if (found.length !== ids.length) {
        throw new HttpError(400, 'Los personajes deben pertenecer al libro del capítulo');
      }
    }

    await prisma.$transaction([
      prisma.chapterCharacter.deleteMany({ where: { chapterId: id } }),
      prisma.chapterCharacter.createMany({
        data: cast.map((entry, position) => ({ ...entry, chapterId: id, position })),
      }),
    ]);

    res.json(await getChapterOrThrow(id));
  }),
);
