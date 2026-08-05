import { getDb } from './database';
import { touchBook } from './books';
import { newId, now, text } from './util';
import type { Plot, PlotEvent, PlotPromise } from '../types';

interface EventRow {
  id: string;
  book_id: string;
  position: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface PromiseRow {
  id: string;
  book_id: string;
  title: string;
  description: string | null;
  setup_event_id: string;
  payoff_event_id: string | null;
  created_at: string;
  updated_at: string;
  setup_position: number;
  setup_title: string;
  payoff_position: number | null;
  payoff_title: string | null;
}

const toEvent = (r: EventRow): PlotEvent => ({
  id: r.id,
  bookId: r.book_id,
  position: r.position,
  title: r.title,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toPromise = (r: PromiseRow): PlotPromise => ({
  id: r.id,
  bookId: r.book_id,
  title: r.title,
  description: r.description,
  setupEventId: r.setup_event_id,
  setupEvent: { id: r.setup_event_id, position: r.setup_position, title: r.setup_title },
  payoffEventId: r.payoff_event_id,
  payoffEvent:
    r.payoff_event_id !== null && r.payoff_position !== null && r.payoff_title !== null
      ? { id: r.payoff_event_id, position: r.payoff_position, title: r.payoff_title }
      : null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * Sucesos y promesas se cargan juntos y toda mutación devuelve el conjunto
 * entero, igual que en la API: borrar un suceso puede arrastrar promesas
 * (CASCADE en la siembra) y dejar otras pendientes (SET NULL en el pago) a la
 * vez, así que devolver sólo el elemento tocado no permite reconstruir la
 * vista.
 */
export async function loadPlot(bookId: string): Promise<Plot> {
  const db = await getDb();

  const [events, promises] = await Promise.all([
    db.getAllAsync<EventRow>(
      'SELECT * FROM plot_events WHERE book_id = ? ORDER BY position ASC',
      bookId,
    ),
    db.getAllAsync<PromiseRow>(
      `SELECT p.*,
              s.position AS setup_position,
              s.title    AS setup_title,
              o.position AS payoff_position,
              o.title    AS payoff_title
       FROM plot_promises p
       JOIN plot_events s ON s.id = p.setup_event_id
       LEFT JOIN plot_events o ON o.id = p.payoff_event_id
       WHERE p.book_id = ?
       ORDER BY s.position ASC, p.title COLLATE NOCASE ASC`,
      bookId,
    ),
  ]);

  return { events: events.map(toEvent), promises: promises.map(toPromise) };
}

export async function createEvent(
  bookId: string,
  input: { title: string; description?: string | null },
): Promise<Plot> {
  const db = await getDb();
  const ts = now();

  // Exclusiva por lo mismo que el alta de capítulo: leer MAX(position) y
  // luego insertar tiene que ser atómico, y withTransactionAsync no aísla.
  await db.withExclusiveTransactionAsync(async (txn) => {
    const max = await txn.getFirstAsync<{ max_position: number | null }>(
      'SELECT MAX(position) AS max_position FROM plot_events WHERE book_id = ?',
      bookId,
    );
    await txn.runAsync(
      `INSERT INTO plot_events (id, book_id, position, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      bookId,
      (max?.max_position ?? -1) + 1,
      input.title.trim(),
      text(input.description),
      ts,
      ts,
    );
  });

  await touchBook(bookId);
  return loadPlot(bookId);
}

export async function updateEvent(
  id: string,
  patch: { title?: string; description?: string | null },
): Promise<Plot> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM plot_events WHERE id = ?',
    id,
  );
  if (!row) throw new Error('Suceso no encontrado');

  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    values.push(patch.title.trim());
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    values.push(text(patch.description));
  }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(now(), id);
    await db.runAsync(`UPDATE plot_events SET ${sets.join(', ')} WHERE id = ?`, ...(values as never[]));
  }

  await touchBook(row.book_id);
  return loadPlot(row.book_id);
}

export async function deleteEvent(id: string): Promise<Plot> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM plot_events WHERE id = ?',
    id,
  );
  if (!row) throw new Error('Suceso no encontrado');

  await db.runAsync('DELETE FROM plot_events WHERE id = ?', id);
  await touchBook(row.book_id);
  return loadPlot(row.book_id);
}

export async function reorderEvents(bookId: string, ids: string[]): Promise<Plot> {
  const db = await getDb();
  const current = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM plot_events WHERE book_id = ?',
    bookId,
  );
  const currentIds = new Set(current.map((e) => e.id));

  if (
    ids.length !== currentIds.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !currentIds.has(id))
  ) {
    throw new Error('La lista de orden debe contener exactamente los sucesos del libro');
  }

  // Exclusiva: a mitad del bucle hay posiciones repetidas.
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [position, id] of ids.entries()) {
      await txn.runAsync('UPDATE plot_events SET position = ? WHERE id = ?', position, id);
    }
  });

  await touchBook(bookId);
  return loadPlot(bookId);
}

/** Los sucesos referenciados por una promesa deben ser del mismo libro. */
async function assertEventsBelongToBook(bookId: string, eventIds: string[]): Promise<void> {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) return;

  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const found = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM plot_events WHERE book_id = ? AND id IN (${placeholders})`,
    bookId,
    ...ids,
  );
  if (found.length !== ids.length) {
    throw new Error('Los sucesos de la promesa deben pertenecer a este libro');
  }
}

export async function createPromise(
  bookId: string,
  input: {
    title: string;
    description?: string | null;
    setupEventId: string;
    payoffEventId?: string | null;
  },
): Promise<Plot> {
  const db = await getDb();
  const payoffEventId = input.payoffEventId ?? null;

  await assertEventsBelongToBook(
    bookId,
    [input.setupEventId, payoffEventId].filter((id): id is string => id !== null),
  );

  const ts = now();
  await db.runAsync(
    `INSERT INTO plot_promises
       (id, book_id, title, description, setup_event_id, payoff_event_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    bookId,
    input.title.trim(),
    text(input.description),
    input.setupEventId,
    payoffEventId,
    ts,
    ts,
  );

  await touchBook(bookId);
  return loadPlot(bookId);
}

/**
 * `payoffEventId` ausente = no tocar; `null` explícito = volver a pendiente.
 * Es justo la distinción que necesita "desmarcar como pagada", así que no se
 * puede colapsar a un `?? null`.
 */
export async function updatePromise(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    setupEventId?: string;
    payoffEventId?: string | null;
  },
): Promise<Plot> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM plot_promises WHERE id = ?',
    id,
  );
  if (!row) throw new Error('Promesa no encontrada');

  const referenced = [patch.setupEventId, patch.payoffEventId].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  await assertEventsBelongToBook(row.book_id, referenced);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    values.push(patch.title.trim());
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    values.push(text(patch.description));
  }
  if (patch.setupEventId !== undefined) {
    sets.push('setup_event_id = ?');
    values.push(patch.setupEventId);
  }
  if (patch.payoffEventId !== undefined) {
    sets.push('payoff_event_id = ?');
    values.push(patch.payoffEventId);
  }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(now(), id);
    await db.runAsync(
      `UPDATE plot_promises SET ${sets.join(', ')} WHERE id = ?`,
      ...(values as never[]),
    );
  }

  await touchBook(row.book_id);
  return loadPlot(row.book_id);
}

export async function deletePromise(id: string): Promise<Plot> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM plot_promises WHERE id = ?',
    id,
  );
  if (!row) throw new Error('Promesa no encontrada');

  await db.runAsync('DELETE FROM plot_promises WHERE id = ?', id);
  await touchBook(row.book_id);
  return loadPlot(row.book_id);
}
