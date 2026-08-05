/**
 * Traducción a SQLite del schema de Postgres (`api/prisma/schema.prisma`).
 * Se conservan a propósito las mismas decisiones que en la web:
 *
 * - `ON DELETE CASCADE` en todo, SALVO `plot_promises.payoff_event_id`, que es
 *   `SET NULL`: borrar el suceso donde se paga devuelve la promesa a
 *   "pendiente" (información útil); borrar el de la siembra la deja sin
 *   sentido, así que se va con él.
 * - SIN `UNIQUE(book_id, position)` en `chapters` ni `plot_events`: reordenar
 *   en transacción pasa por estados con posiciones repetidas.
 * - `age` es TEXT, no INTEGER: admite "unos cuarenta" o "inmortal".
 * - `character_relationships` es dirigida y no recíproca, con UNIQUE por
 *   (personaje, relacionado, tipo) y un CHECK que impide la auto-relación.
 *
 * Postgres usa un enum para el rol; SQLite no tiene enums, así que va como
 * TEXT con CHECK. Las fechas van como TEXT ISO-8601 (comparables y ordenables
 * lexicográficamente, que es lo único que necesitamos).
 */
export const MIGRATIONS: string[] = [
  // --- v1: esquema inicial completo -----------------------------------------
  `
  CREATE TABLE books (
    id          TEXT PRIMARY KEY NOT NULL,
    title       TEXT NOT NULL,
    author      TEXT,
    synopsis    TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE characters (
    id                   TEXT PRIMARY KEY NOT NULL,
    book_id              TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    role                 TEXT NOT NULL DEFAULT 'SECONDARY'
                           CHECK (role IN ('PROTAGONIST','ANTAGONIST','SECONDARY','EXTRA')),
    age                  TEXT,
    photo_url            TEXT,
    physical_description TEXT,
    personality          TEXT,
    backstory            TEXT,
    personal_plot        TEXT,
    arc_summary          TEXT,
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  );
  CREATE INDEX characters_book_id_idx ON characters(book_id);

  CREATE TABLE character_arc_stages (
    id           TEXT PRIMARY KEY NOT NULL,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT
  );
  CREATE INDEX character_arc_stages_character_id_position_idx
    ON character_arc_stages(character_id, position);

  CREATE TABLE character_relationships (
    id                   TEXT PRIMARY KEY NOT NULL,
    character_id         TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    related_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    type                 TEXT NOT NULL,
    description          TEXT,
    CONSTRAINT character_relationships_no_self CHECK (character_id <> related_character_id),
    UNIQUE (character_id, related_character_id, type)
  );
  CREATE INDEX character_relationships_character_id_idx
    ON character_relationships(character_id);

  CREATE TABLE chapters (
    id            TEXT PRIMARY KEY NOT NULL,
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    title         TEXT NOT NULL,
    synopsis      TEXT,
    notes         TEXT,
    text_a_label  TEXT NOT NULL DEFAULT 'Borrador',
    text_b_label  TEXT NOT NULL DEFAULT 'Reescritura',
    text_a        TEXT,
    text_b        TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE INDEX chapters_book_id_position_idx ON chapters(book_id, position);

  CREATE TABLE chapter_characters (
    id           TEXT PRIMARY KEY NOT NULL,
    chapter_id   TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    action       TEXT,
    UNIQUE (chapter_id, character_id)
  );
  CREATE INDEX chapter_characters_chapter_id_position_idx
    ON chapter_characters(chapter_id, position);

  CREATE TABLE plot_events (
    id          TEXT PRIMARY KEY NOT NULL,
    book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX plot_events_book_id_position_idx ON plot_events(book_id, position);

  CREATE TABLE plot_promises (
    id              TEXT PRIMARY KEY NOT NULL,
    book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    -- CASCADE: una promesa sin siembra no significa nada.
    setup_event_id  TEXT NOT NULL REFERENCES plot_events(id) ON DELETE CASCADE,
    -- SET NULL: borrar el suceso del pago la devuelve a "pendiente".
    payoff_event_id TEXT REFERENCES plot_events(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  CREATE INDEX plot_promises_book_id_idx ON plot_promises(book_id);
  CREATE INDEX plot_promises_setup_event_id_idx ON plot_promises(setup_event_id);
  CREATE INDEX plot_promises_payoff_event_id_idx ON plot_promises(payoff_event_id);
  `,
];
