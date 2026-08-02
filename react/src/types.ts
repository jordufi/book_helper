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
