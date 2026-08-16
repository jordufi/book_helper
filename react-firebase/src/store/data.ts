import type { CharacterRole } from '../types';

/**
 * Forma del documento guardado en IndexedDB. Calca las tablas de
 * `api/prisma/schema.prisma`: arrays planos y no anidados a propósito — las
 * relaciones cruzan personajes y las promesas cruzan sucesos, así que las
 * cascadas de `store.ts` se leen igual que el SQL que sustituyen.
 *
 * Sin `photoUrl` en ningún sitio: esta versión no lleva fotos (ver CLAUDE.md).
 */

export interface DbBook {
  id: string;
  title: string;
  author: string | null;
  synopsis: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbCharacter {
  id: string;
  bookId: string;
  name: string;
  role: CharacterRole;
  age: string | null;
  physicalDescription: string | null;
  personality: string | null;
  backstory: string | null;
  personalPlot: string | null;
  arcSummary: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbArcStage {
  id: string;
  characterId: string;
  position: number;
  title: string;
  description: string | null;
}

export interface DbRelationship {
  id: string;
  characterId: string;
  relatedCharacterId: string;
  type: string;
  description: string | null;
}

export interface DbChapter {
  id: string;
  bookId: string;
  position: number;
  title: string;
  synopsis: string | null;
  notes: string | null;
  textALabel: string;
  textBLabel: string;
  textA: string | null;
  textB: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbCastEntry {
  id: string;
  chapterId: string;
  characterId: string;
  position: number;
  action: string | null;
}

export interface DbPlotEvent {
  id: string;
  bookId: string;
  position: number;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbPromise {
  id: string;
  bookId: string;
  title: string;
  description: string | null;
  setupEventId: string;
  payoffEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceData {
  schemaVersion: 1;
  books: DbBook[];
  characters: DbCharacter[];
  arcStages: DbArcStage[];
  relationships: DbRelationship[];
  chapters: DbChapter[];
  cast: DbCastEntry[];
  plotEvents: DbPlotEvent[];
  plotPromises: DbPromise[];
  /** Libros con cambios desde la última descarga a JSON. Clave: bookId. */
  undownloaded: Record<string, true>;
}

export const CURRENT_SCHEMA_VERSION = 1 as const;

export function emptyWorkspace(): WorkspaceData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    books: [],
    characters: [],
    arcStages: [],
    relationships: [],
    chapters: [],
    cast: [],
    plotEvents: [],
    plotPromises: [],
    undownloaded: {},
  };
}

/**
 * Valida la forma mínima del documento cargado desde IndexedDB. Si no cuadra
 * (versión de esquema futura, dato corrupto, primera vez que se abre la app),
 * se arranca con un workspace vacío en vez de reventar — igual de importante
 * aquí que en `transfer.ts`: es persistencia local, no un fichero externo,
 * pero puede llevar meses sin tocarse entre una versión de la app y la
 * siguiente.
 */
export function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === CURRENT_SCHEMA_VERSION &&
    Array.isArray(v.books) &&
    Array.isArray(v.characters) &&
    Array.isArray(v.arcStages) &&
    Array.isArray(v.relationships) &&
    Array.isArray(v.chapters) &&
    Array.isArray(v.cast) &&
    Array.isArray(v.plotEvents) &&
    Array.isArray(v.plotPromises) &&
    typeof v.undownloaded === 'object' &&
    v.undownloaded !== null
  );
}
