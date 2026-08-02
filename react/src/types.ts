export const CHARACTER_ROLES = ['PROTAGONIST', 'ANTAGONIST', 'SECONDARY', 'EXTRA'] as const;
export type CharacterRole = (typeof CHARACTER_ROLES)[number];

export const ROLE_LABELS: Record<CharacterRole, string> = {
  PROTAGONIST: 'Protagonista',
  ANTAGONIST: 'Antagonista',
  SECONDARY: 'Secundario',
  EXTRA: 'Figurante',
};

export interface Book {
  id: string;
  title: string;
  author: string | null;
  synopsis: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { characters: number };
}

/** Versión ligera que devuelve la lista de un libro. */
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

// --- Capítulos ---------------------------------------------------------------

/** Versión ligera de la lista de capítulos: SIN el texto, que puede ser enorme. */
export interface ChapterSummary {
  id: string;
  bookId: string;
  position: number;
  title: string;
  synopsis: string | null;
  updatedAt: string;
  _count: { cast: number };
}

/** Un personaje en un capítulo y qué hace en él. */
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

/** Campos que acepta el PATCH de capítulo. Se envían SÓLO los que cambiaron. */
export type ChapterPatch = Partial<
  Pick<Chapter, 'title' | 'synopsis' | 'notes' | 'textALabel' | 'textBLabel' | 'textA' | 'textB'>
>;

// --- Trama ---------------------------------------------------------------------

/** Referencia ligera a un suceso, incrustada en las promesas. */
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

/** La tab de Trama se pinta con una sola petición. */
export interface Plot {
  events: PlotEvent[];
  promises: PlotPromise[];
}
