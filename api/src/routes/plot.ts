import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { assertBookExists, lockBookOrThrow } from '../lib/books.js';
import { HttpError, asyncHandler, notFound } from '../lib/http.js';
import {
  plotEventCreateSchema,
  plotEventOrderSchema,
  plotEventUpdateSchema,
  plotPromiseCreateSchema,
  plotPromiseUpdateSchema,
} from '../lib/schemas.js';

const promiseInclude = {
  setupEvent: { select: { id: true, position: true, title: true } },
  payoffEvent: { select: { id: true, position: true, title: true } },
} as const;

/**
 * Toda mutación de trama devuelve { events, promises } recargado: borrar o
 * mover un suceso puede arrastrar promesas (cascade en la siembra) o dejarlas
 * pendientes (set null en el pago), así que devolver sólo el elemento tocado
 * no permite reconstruir la vista. Mismo principio que "las mutaciones de
 * personaje devuelven el detalle completo", aplicado a nivel de libro.
 */
async function loadPlot(bookId: string) {
  const [events, promises] = await Promise.all([
    prisma.plotEvent.findMany({ where: { bookId }, orderBy: { position: 'asc' } }),
    prisma.plotPromise.findMany({
      where: { bookId },
      include: promiseInclude,
      orderBy: [{ setupEvent: { position: 'asc' } }, { title: 'asc' }],
    }),
  ]);
  return { events, promises };
}

/** Valida que los sucesos referenciados por una promesa sean del mismo libro. */
async function assertEventsBelongToBook(bookId: string, eventIds: string[]) {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) return;
  const found = await prisma.plotEvent.findMany({
    where: { id: { in: ids }, bookId },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new HttpError(400, 'Los sucesos de la promesa deben pertenecer a este libro');
  }
}

// --- Anidadas bajo un libro --------------------------------------------------

export const bookPlotRouter = Router({ mergeParams: true });

bookPlotRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    await assertBookExists(bookId);
    res.json(await loadPlot(bookId));
  }),
);

bookPlotRouter.post(
  '/events',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const data = plotEventCreateSchema.parse(req.body);

    // Leer el máximo y crear tiene que ser atómico: ver lockBookOrThrow.
    await prisma.$transaction(async (tx) => {
      await lockBookOrThrow(tx, bookId);

      const { _max } = await tx.plotEvent.aggregate({
        where: { bookId },
        _max: { position: true },
      });

      await tx.plotEvent.create({
        data: { ...data, bookId, position: (_max.position ?? -1) + 1 },
      });
    });

    res.status(201).json(await loadPlot(bookId));
  }),
);

/** Reordena la línea de tiempo entera, igual que el orden de capítulos. */
bookPlotRouter.put(
  '/events/order',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const { ids } = plotEventOrderSchema.parse(req.body);
    await assertBookExists(bookId);

    const current = await prisma.plotEvent.findMany({ where: { bookId }, select: { id: true } });
    const currentIds = new Set(current.map((e) => e.id));
    const uniqueIds = new Set(ids);

    if (ids.length !== currentIds.size || uniqueIds.size !== ids.length || ids.some((id) => !currentIds.has(id))) {
      throw new HttpError(400, 'La lista de orden debe contener exactamente los sucesos del libro');
    }

    await prisma.$transaction(
      ids.map((id, position) => prisma.plotEvent.update({ where: { id }, data: { position } })),
    );

    res.json(await loadPlot(bookId));
  }),
);

bookPlotRouter.post(
  '/promises',
  asyncHandler(async (req, res) => {
    const { bookId } = req.params as { bookId: string };
    const data = plotPromiseCreateSchema.parse(req.body);
    await assertBookExists(bookId);

    await assertEventsBelongToBook(
      bookId,
      [data.setupEventId, data.payoffEventId].filter((id): id is string => id !== null),
    );

    await prisma.plotPromise.create({ data: { ...data, bookId } });
    res.status(201).json(await loadPlot(bookId));
  }),
);

// --- Por id de suceso ---------------------------------------------------------

export const plotEventsRouter = Router();

plotEventsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = plotEventUpdateSchema.parse(req.body);
    const event = await prisma.plotEvent.findUnique({
      where: { id: req.params.id },
      select: { bookId: true },
    });
    if (!event) throw notFound('Suceso');

    await prisma.plotEvent.update({ where: { id: req.params.id }, data });
    res.json(await loadPlot(event.bookId));
  }),
);

plotEventsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const exists = await prisma.plotEvent.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!exists) throw notFound('Suceso');

    await prisma.plotEvent.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

// --- Por id de promesa ---------------------------------------------------------

export const plotPromisesRouter = Router();

plotPromisesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = plotPromiseUpdateSchema.parse(req.body);

    const promise = await prisma.plotPromise.findUnique({
      where: { id: req.params.id },
      select: { bookId: true },
    });
    if (!promise) throw notFound('Promesa');

    await assertEventsBelongToBook(
      promise.bookId,
      [data.setupEventId, data.payoffEventId].filter((id): id is string => !!id),
    );

    await prisma.plotPromise.update({ where: { id: req.params.id }, data });
    res.json(await loadPlot(promise.bookId));
  }),
);

plotPromisesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const exists = await prisma.plotPromise.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!exists) throw notFound('Promesa');

    await prisma.plotPromise.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
