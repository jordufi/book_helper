import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Listas de parámetros de cada stack. Tenerlas en un sitio y derivar de aquí
 * las props de cada pantalla evita el error clásico de tipar `navigation` y
 * `route` a mano en cada componente: quedan sin comprobar y dejan de casar con
 * lo que espera React Navigation.
 */
export type CharactersStackParams = {
  CharactersList: undefined;
  CharacterDetail: { characterId: string };
};

export type ChaptersStackParams = {
  ChaptersList: undefined;
  ChapterDetail: { chapterId: string };
};

export type CharactersListProps = NativeStackScreenProps<CharactersStackParams, 'CharactersList'>;
export type CharacterDetailProps = NativeStackScreenProps<CharactersStackParams, 'CharacterDetail'>;
export type ChaptersListProps = NativeStackScreenProps<ChaptersStackParams, 'ChaptersList'>;
export type ChapterDetailProps = NativeStackScreenProps<ChaptersStackParams, 'ChapterDetail'>;
