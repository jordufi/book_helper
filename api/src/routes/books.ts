import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { bookCreateSchema, bookUpdateSchema } from '../lib/schemas.js';

export const booksRouter = Router();

booksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const books = await prisma.book.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { characters: true } } },
    });
    res.json(books);
  }),
);

booksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = bookCreateSchema.parse(req.body);
    const book = await prisma.book.create({ data });
    res.status(201).json(book);
  }),
);

booksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) throw notFound('Libro');
    res.json(book);
  }),
);

booksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = bookUpdateSchema.parse(req.body);
    const book = await prisma.book.update({ where: { id: req.params.id }, data });
    res.json(book);
  }),
);

booksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.book.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
