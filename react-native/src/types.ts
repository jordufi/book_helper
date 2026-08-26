export const CHARACTER_ROLES = ['PROTAGONIST', 'ANTAGONIST', 'SECONDARY', 'EXTRA'] as const;
export type CharacterRole = (typeof CHARACTER_ROLES)[number];

// Las etiquetas legibles de cada rol viven en `t.roles` (`src/i18n/`), no
// aquí: dependen del idioma activo, así que no pueden ser una constante fija.

/**
 * Las formas son deliberadamente las MISMAS que en `react/src/types.ts`: es lo
 * que permite que el JSON exportado por la web se importe aquí tal cual.
 */
export interface Book {
  id: string;
  title: string;
  author: string | null;
  synopsis: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { characters: number; chapters: number; plotEvents: number };
}

/** Versión ligera para las listas. */
export interface CharacterSummary {
  id: string;
  name: string;
  role: CharacterRole;
  age: string | null;
  photoUrl: string | null;
  arcSummary: string | null;
  updatedAt: string;
}

export interface ArcStage {
  id: string;
  characterId: string;
  position: number;
  title: string;
  description: string | null;
}

export interface Relationship {
  id: string;
  characterId: string;
  relatedCharacterId: string;
  type: string;
  description: string | null;
  relatedCharacter: {
    id: string;
    name: string;
    photoUrl: string | null;
    role: CharacterRole;
  };
}

export interface Character {
  id: string;
  bookId: string;
  name: string;
  role: CharacterRole;
  age: string | null;
  photoUrl: string | null;
  physicalDescription: string | null;
  personality: string | null;
  backstory: string | null;
  /** Lo que le OCURRE durante el libro. */
  personalPlot: string | null;
  /** Cómo CAMBIA por dentro. Distinto de personalPlot a propósito. */
  arcSummary: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  arcStages: ArcStage[];
  relationships: Relationship[];
}

export type CharacterInput = Partial<
  Pick<
    Character,
    | 'name'
    | 'role'
    | 'age'
    | 'physicalDescription'
    | 'personality'
    | 'backstory'
    | 'personalPlot'
    | 'arcSummary'
    | 'notes'
  >
>;

// --- Capítulos ---------------------------------------------------------------

/** Sin el texto: puede pesar cientos de KB y esto alimenta una lista. */
export interface ChapterSummary {
  id: string;
  bookId: string;
  position: number;
  title: string;
  synopsis: string | null;
  updatedAt: string;
  _count: { cast: number };
}

export interface ChapterCastEntry {
  id: string;
  chapterId: string;
  characterId: string;
  position: number;
  action: string | null;
  character: { id: string; name: string; photoUrl: string | null; role: CharacterRole };
}

export interface Chapter {
  id: string;
  bookId: string;
  position: number;
  title: string;
  synopsis: string | null;
  notes: string | null;
  /** Rótulos editables de los dos paneles ("Borrador" / "Reescritura"). */
  textALabel: string;
  textBLabel: string;
  textA: string | null;
  textB: string | null;
  createdAt: string;
  updatedAt: string;
  cast: ChapterCastEntry[];
}

/** Campos que acepta el update parcial. Se envían SÓLO los que cambiaron. */
export type ChapterPatch = Partial<
  Pick<Chapter, 'title' | 'synopsis' | 'notes' | 'textALabel' | 'textBLabel' | 'textA' | 'textB'>
>;

// --- Trama -------------------------------------------------------------------

export interface PlotEventRef {
  id: string;
  position: number;
  title: string;
}

export interface PlotEvent {
  id: string;
  bookId: string;
  position: number;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlotPromise {
  id: string;
  bookId: string;
  title: string;
  description: string | null;
  setupEventId: string;
  setupEvent: PlotEventRef;
  /** null = promesa pendiente. Es el estado que hay que vigilar. */
  payoffEventId: string | null;
  payoffEvent: PlotEventRef | null;
  createdAt: string;
  updatedAt: string;
}

/** Toda la trama se carga y se invalida junta. */
export interface Plot {
  events: PlotEvent[];
  promises: PlotPromise[];
}
