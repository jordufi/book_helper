import { es } from './es';
import { en } from './en';
import { fr } from './fr';

export type { Dict } from './es';
export type Locale = 'es' | 'en' | 'fr';

export const dictionaries = { es, en, fr } as const satisfies Record<Locale, unknown>;
