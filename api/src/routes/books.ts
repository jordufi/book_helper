import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { bookCreateSchema, bookImportSchema, bookUpdateSchema } from '../lib/schemas.js';
import { deletePhotoFile } from '../lib/upload.js';

export const booksRouter = Router();

const bookSummaryInclude = {
  _count: { select: { characters: true, chapters: true, plotEvents: true } },
} as const;

booksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const books = await prisma.book.findMany({
      orderBy: { updatedAt: 'desc' },
      include: bookSummaryInclude,
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

/**
 * Crea un libro NUEVO a partir de un JSON exportado con GET /:id/export.
 * Siempre aditivo (nunca sobrescribe un libro existente): todo se inserta con
 * ids nuevos, remapeando en memoria las referencias del propio fichero
 * (personaje→relación, personaje→reparto, suceso→promesa). Va en una única
 * transacción: si algo falla a mitad, no queda un libro a medias.
 */
booksRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const data = bookImportSchema.parse(req.body);

    const bookId = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({ data: data.book });

      // Personajes primero, sin arco ni relaciones: hacen falta todos los ids
      // nuevos antes de poder remapear las relaciones (que pueden apuntar a
      // cualquier otro personaje del libro, no sólo a los ya creados).
      const characterIdMap = new Map<string, string>();
      for (const c of data.characters) {
        const created = await tx.character.create({
          data: {
            bookId: book.id,
            name: c.name,
            role: c.role,
            age: c.age,
            physicalDescription: c.physicalDescription,
            personality: c.personality,
            backstory: c.backstory,
            personalPlot: c.personalPlot,
            arcSummary: c.arcSummary,
            notes: c.notes,
          },
        });
        characterIdMap.set(c.id, created.id);
      }

      for (const c of data.characters) {
        const newCharacterId = characterIdMap.get(c.id)!;

        if (c.arcStages.length > 0) {
          await tx.characterArcStage.createMany({
            data: c.arcStages.map((s, position) => ({
              characterId: newCharacterId,
              position,
              title: s.title,
              description: s.description,
            })),
          });
        }

        // Sin dedupe no saltaría el @@unique([characterId, relatedCharacterId,
        // type]) como un 409 al usuario: rompería la transacción entera,
        // porque Postgres marca la transacción como abortada en el primer
        // error aunque el catch de JS lo silencie.
        const seen = new Set<string>();
        const relationships = c.relationships
          .map((r) => ({ ...r, newRelatedId: characterIdMap.get(r.relatedCharacterId) }))
          .filter((r) => {
            if (!r.newRelatedId || r.newRelatedId === newCharacterId) return false;
            const key = `${r.newRelatedId}:${r.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        if (relationships.length > 0) {
          await tx.characterRelationship.createMany({
            data: relationships.map((r) => ({
              characterId: newCharacterId,
              relatedCharacterId: r.newRelatedId!,
              type: r.type,
              description: r.description,
            })),
          });
        }
      }

      const chapterIdMap = new Map<string, string>();
      for (const [position, ch] of data.chapters.entries()) {
        const created = await tx.chapter.create({
          data: {
            bookId: book.id,
            position,
            title: ch.title,
            synopsis: ch.synopsis,
            notes: ch.notes,
            textALabel: ch.textALabel,
            textBLabel: ch.textBLabel,
            textA: ch.textA,
            textB: ch.textB,
          },
        });
        chapterIdMap.set(ch.id, created.id);
      }

      for (const ch of data.chapters) {
        const newChapterId = chapterIdMap.get(ch.id)!;
        const seen = new Set<string>();
        const cast = ch.cast
          .map((entry) => ({ ...entry, newCharacterId: characterIdMap.get(entry.characterId) }))
          .filter((entry) => {
            if (!entry.newCharacterId || seen.has(entry.newCharacterId)) return false;
            seen.add(entry.newCharacterId);
            return true;
          });
        if (cast.length > 0) {
          await tx.chapterCharacter.createMany({
            data: cast.map((entry, position) => ({
              chapterId: newChapterId,
              characterId: entry.newCharacterId!,
              position,
              action: entry.action,
            })),
          });
        }
      }

      // Sucesos antes que promesas: una promesa siempre necesita el id nuevo
      // de su suceso-siembra.
      const eventIdMap = new Map<string, string>();
      for (const [position, e] of data.plot.events.entries()) {
        const created = await tx.plotEvent.create({
          data: { bookId: book.id, position, title: e.title, description: e.description },
        });
        eventIdMap.set(e.id, created.id);
      }

      const promises = data.plot.promises
        .map((p) => ({
          title: p.title,
          description: p.description,
          setupEventId: eventIdMap.get(p.setupEventId),
          payoffEventId: p.payoffEventId ? (eventIdMap.get(p.payoffEventId) ?? null) : null,
        }))
        // Sin siembra válida la promesa no significa nada (igual que CASCADE
        // en setup_event_id): se descarta en vez de romper el import entero.
        .filter((p): p is typeof p & { setupEventId: string } => Boolean(p.setupEventId));
      if (promises.length > 0) {
        await tx.plotPromise.createMany({
          data: promises.map((p) => ({ ...p, bookId: book.id })),
        });
      }

      return book.id;
    });

    const book = await prisma.book.findUnique({ where: { id: bookId }, include: bookSummaryInclude });
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

/**
 * Vuelca el libro entero a un JSON portable: sin fotos (son ficheros en
 * ./uploads, no datos), pero con todo lo demás, incluido el texto de los
 * capítulos. Conserva los ids reales de personajes y sucesos sólo para que
 * relaciones/reparto/promesas puedan referenciarse entre sí *dentro del
 * fichero*; el import los descarta y genera otros nuevos.
 */
booksRouter.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!book) throw notFound('Libro');

    const [characters, chapters, events, promises] = await Promise.all([
      prisma.character.findMany({
        where: { bookId: book.id },
        orderBy: { createdAt: 'asc' },
        include: {
          arcStages: { orderBy: { position: 'asc' } },
          relationships: true,
        },
      }),
      prisma.chapter.findMany({
        where: { bookId: book.id },
        orderBy: { position: 'asc' },
        include: { cast: { orderBy: { position: 'asc' } } },
      }),
      prisma.plotEvent.findMany({ where: { bookId: book.id }, orderBy: { position: 'asc' } }),
      prisma.plotPromise.findMany({ where: { bookId: book.id } }),
    ]);

    res.json({
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      book: { title: book.title, author: book.author, synopsis: book.synopsis },
      characters: characters.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        age: c.age,
        physicalDescription: c.physicalDescription,
        personality: c.personality,
        backstory: c.backstory,
        personalPlot: c.personalPlot,
        arcSummary: c.arcSummary,
        notes: c.notes,
        arcStages: c.arcStages.map((s) => ({ title: s.title, description: s.description })),
        relationships: c.relationships.map((r) => ({
          relatedCharacterId: r.relatedCharacterId,
          type: r.type,
          description: r.description,
        })),
      })),
      chapters: chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        synopsis: ch.synopsis,
        notes: ch.notes,
        textALabel: ch.textALabel,
        textBLabel: ch.textBLabel,
        textA: ch.textA,
        textB: ch.textB,
        cast: ch.cast.map((entry) => ({ characterId: entry.characterId, action: entry.action })),
      })),
      plot: {
        events: events.map((e) => ({ id: e.id, title: e.title, description: e.description })),
        promises: promises.map((p) => ({
          title: p.title,
          description: p.description,
          setupEventId: p.setupEventId,
          payoffEventId: p.payoffEventId,
        })),
      },
    });
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
    // La cascada de la BD borra los personajes, pero no sus ficheros de foto:
    // hay que recogerlos antes de borrar y limpiarlos después, igual que al
    // borrar un personaje suelto.
    const characters = await prisma.character.findMany({
      where: { bookId: req.params.id },
      select: { photoUrl: true },
    });

    await prisma.book.delete({ where: { id: req.params.id } });

    for (const character of characters) deletePhotoFile(character.photoUrl);

    res.status(204).end();
  }),
);
