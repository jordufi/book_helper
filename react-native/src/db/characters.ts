import { getDb } from './database';
import { touchBook } from './books';
import { newId, now, text } from './util';
import type { Character, CharacterInput, CharacterRole, CharacterSummary } from '../types';

/**
 * En Postgres `role` es un enum y ordena por orden de declaración; aquí es
 * TEXT y ordenaría alfabéticamente (ANTAGONIST, EXTRA, PROTAGONIST…), que no
 * es lo que se ve en la web. Este CASE reproduce el orden original.
 */
const ROLE_ORDER = `CASE role
  WHEN 'PROTAGONIST' THEN 0
  WHEN 'ANTAGONIST'  THEN 1
  WHEN 'SECONDARY'   THEN 2
  ELSE 3
END`;

interface CharacterRow {
  id: string;
  book_id: string;
  name: string;
  role: CharacterRole;
  age: string | null;
  photo_url: string | null;
  physical_description: string | null;
  personality: string | null;
  backstory: string | null;
  personal_plot: string | null;
  arc_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RelationshipRow {
  id: string;
  character_id: string;
  related_character_id: string;
  type: string;
  description: string | null;
  related_name: string;
  related_photo_url: string | null;
  related_role: CharacterRole;
}

export async function listCharacters(bookId: string): Promise<CharacterSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CharacterRow>(
    `SELECT * FROM characters WHERE book_id = ?
     ORDER BY ${ROLE_ORDER}, name COLLATE NOCASE ASC`,
    bookId,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    age: r.age,
    photoUrl: r.photo_url,
    arcSummary: r.arc_summary,
    updatedAt: r.updated_at,
  }));
}

/**
 * Detalle completo, con el arco ordenado y las relaciones ya resueltas (nombre
 * y rol del otro personaje incluidos). Igual que en la API: la pantalla no
 * debe encadenar consultas para pintar una ficha.
 */
export async function getCharacter(id: string): Promise<Character | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CharacterRow>('SELECT * FROM characters WHERE id = ?', id);
  if (!row) return null;

  const [stages, relationships] = await Promise.all([
    db.getAllAsync<{ id: string; character_id: string; position: number; title: string; description: string | null }>(
      'SELECT * FROM character_arc_stages WHERE character_id = ? ORDER BY position ASC',
      id,
    ),
    db.getAllAsync<RelationshipRow>(
      `SELECT r.*,
              c.name      AS related_name,
              c.photo_url AS related_photo_url,
              c.role      AS related_role
       FROM character_relationships r
       JOIN characters c ON c.id = r.related_character_id
       WHERE r.character_id = ?
       ORDER BY c.name COLLATE NOCASE ASC`,
      id,
    ),
  ]);

  return {
    id: row.id,
    bookId: row.book_id,
    name: row.name,
    role: row.role,
    age: row.age,
    photoUrl: row.photo_url,
    physicalDescription: row.physical_description,
    personality: row.personality,
    backstory: row.backstory,
    personalPlot: row.personal_plot,
    arcSummary: row.arc_summary,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    arcStages: stages.map((s) => ({
      id: s.id,
      characterId: s.character_id,
      position: s.position,
      title: s.title,
      description: s.description,
    })),
    relationships: relationships.map((r) => ({
      id: r.id,
      characterId: r.character_id,
      relatedCharacterId: r.related_character_id,
      type: r.type,
      description: r.description,
      relatedCharacter: {
        id: r.related_character_id,
        name: r.related_name,
        photoUrl: r.related_photo_url,
        role: r.related_role,
      },
    })),
  };
}

export async function createCharacter(bookId: string, input: CharacterInput): Promise<Character> {
  const db = await getDb();
  const id = newId();
  const ts = now();

  await db.runAsync(
    `INSERT INTO characters
      (id, book_id, name, role, age, photo_url, physical_description, personality,
       backstory, personal_plot, arc_summary, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    bookId,
    (input.name ?? '').trim(),
    input.role ?? 'SECONDARY',
    text(input.age),
    text(input.physicalDescription),
    text(input.personality),
    text(input.backstory),
    text(input.personalPlot),
    text(input.arcSummary),
    text(input.notes),
    ts,
    ts,
  );

  await touchBook(bookId);
  return (await getCharacter(id))!;
}

const CHARACTER_COLUMNS: Record<keyof CharacterInput, string> = {
  name: 'name',
  role: 'role',
  age: 'age',
  physicalDescription: 'physical_description',
  personality: 'personality',
  backstory: 'backstory',
  personalPlot: 'personal_plot',
  arcSummary: 'arc_summary',
  notes: 'notes',
};

export async function updateCharacter(id: string, patch: CharacterInput): Promise<Character> {
  const db = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(CHARACTER_COLUMNS)) {
    const value = patch[key as keyof CharacterInput];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    // name y role son NOT NULL; el resto admite null como "sin rellenar".
    if (key === 'name') values.push(String(value).trim());
    else if (key === 'role') values.push(value);
    else values.push(text(value as string | null));
  }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(now(), id);
    await db.runAsync(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, ...(values as never[]));
  }

  const character = await getCharacter(id);
  if (!character) throw new Error('Personaje no encontrado');
  await touchBook(character.bookId);
  return character;
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ book_id: string }>(
    'SELECT book_id FROM characters WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM characters WHERE id = ?', id);
  if (row) await touchBook(row.book_id);
}

/**
 * Reemplaza el arco entero, igual que `PUT /characters/:id/arc` en la API: la
 * `position` sale del índice del array, así que el orden que manda la pantalla
 * es la verdad. En transacción para no quedarnos sin arco si falla el alta.
 */
export async function saveArc(
  characterId: string,
  stages: { title: string; description: string | null }[],
): Promise<Character> {
  const db = await getDb();

  // Exclusiva: entre el DELETE y los INSERT el arco está vacío. Con una
  // transacción normal (que expo-sqlite NO aísla) una lectura podría colarse
  // ahí y mostrar el personaje sin arco.
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM character_arc_stages WHERE character_id = ?', characterId);
    for (const [position, stage] of stages.entries()) {
      await txn.runAsync(
        `INSERT INTO character_arc_stages (id, character_id, position, title, description)
         VALUES (?, ?, ?, ?, ?)`,
        newId(),
        characterId,
        position,
        stage.title.trim(),
        text(stage.description),
      );
    }
    await txn.runAsync('UPDATE characters SET updated_at = ? WHERE id = ?', now(), characterId);
  });

  const character = await getCharacter(characterId);
  if (!character) throw new Error('Personaje no encontrado');
  await touchBook(character.bookId);
  return character;
}

/**
 * Las relaciones son dirigidas y NO recíprocas por defecto: A puede ver a B
 * como "mentor" mientras B ve a A como "estorbo". La inversa sólo se crea si
 * se pide con `reciprocalType`, y con su propio texto ("hermano"/"hermana").
 * Las dos altas van en una transacción: si la inversa choca con una relación
 * existente, tampoco se crea la primera.
 */
export async function addRelationship(
  characterId: string,
  input: {
    relatedCharacterId: string;
    type: string;
    description?: string | null;
    reciprocalType?: string | null;
  },
): Promise<Character> {
  const db = await getDb();

  if (input.relatedCharacterId === characterId) {
    throw new Error('Un personaje no puede relacionarse consigo mismo');
  }

  const [subject, object] = await Promise.all([
    db.getFirstAsync<{ book_id: string }>('SELECT book_id FROM characters WHERE id = ?', characterId),
    db.getFirstAsync<{ book_id: string }>(
      'SELECT book_id FROM characters WHERE id = ?',
      input.relatedCharacterId,
    ),
  ]);
  if (!subject) throw new Error('Personaje no encontrado');
  if (!object) throw new Error('Personaje relacionado no encontrado');
  if (subject.book_id !== object.book_id) {
    throw new Error('Los dos personajes deben pertenecer al mismo libro');
  }

  const reciprocal = input.reciprocalType?.trim();

  try {
    // Exclusiva: si la inversa choca con una relación ya existente, tampoco
    // debe quedar creada la primera. Con una transacción no aislada podría
    // leerse el estado intermedio en el que sólo existe un sentido.
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO character_relationships
           (id, character_id, related_character_id, type, description)
         VALUES (?, ?, ?, ?, ?)`,
        newId(),
        characterId,
        input.relatedCharacterId,
        input.type.trim(),
        text(input.description),
      );

      if (reciprocal) {
        await txn.runAsync(
          `INSERT INTO character_relationships
             (id, character_id, related_character_id, type, description)
           VALUES (?, ?, ?, ?, NULL)`,
          newId(),
          input.relatedCharacterId,
          characterId,
          reciprocal,
        );
      }
    });
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      throw new Error('Esa relación ya existe');
    }
    throw err;
  }

  await touchBook(subject.book_id);
  return (await getCharacter(characterId))!;
}

export async function deleteRelationship(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM character_relationships WHERE id = ?', id);
}
