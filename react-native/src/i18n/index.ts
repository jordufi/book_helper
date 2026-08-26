import { es } from './es';
import { en } from './en';

export type { Dict } from './es';
export type Locale = 'es' | 'en';

export const dictionaries = { es, en } as const satisfies Record<Locale, unknown>;
