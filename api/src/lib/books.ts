import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { notFound } from './http.js';

/**
 * 404 si el libro no existe. Para las rutas anidadas bajo /books/:bookId que
 * sólo leen: sin esto devuelven 200 con una lista vacía, que le dice al
 * cliente "el libro está vacío" cuando la verdad es "el libro no existe".
 */
export async function assertBookExists(bookId: string): Promise<void> {
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
  if (!book) throw notFound('Libro');
}

/**
 * Comprueba que el libro existe Y bloquea su fila hasta el final de la
 * transacción. Las dos cosas a la vez porque quien necesita el lock ya
 * necesitaba la comprobación.
 *
 * El lock es lo que hace atómico el cálculo de `position` en capítulos y
 * sucesos. Sin él, dos altas simultáneas en el mismo libro (el portátil y el
 * móvil, que es un caso normal aquí) leen el mismo MAX(position) —en READ
 * COMMITTED ninguna ve la fila aún sin confirmar de la otra— y crean dos
 * registros con la misma posición. A partir de ahí `ORDER BY position` deja
 * un orden no determinista y la lista se reordena sola entre recargas.
 *
 * Serializa sólo las altas del MISMO libro, que es exactamente el alcance en
 * el que compiten las posiciones.
 *
 * `books.id` es TEXT, no uuid (ver la migración inicial): nada de castear a
 * ::uuid aquí, fallaría en cada llamada.
 */
export async function lockBookOrThrow(tx: Prisma.TransactionClient, bookId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM books WHERE id = ${bookId} FOR UPDATE
  `;
  if (rows.length === 0) throw notFound('Libro');
}
