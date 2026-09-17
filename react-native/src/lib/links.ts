import { Linking, Platform } from 'react-native';

/**
 * Enlaces externos de la app (ficha de la tienda y documentos legales).
 *
 * Están aquí y no incrustados en `SettingsScreen` porque el identificador del
 * paquete se repite en dos URLs y equivocarse en una sola letra manda al
 * usuario a una ficha inexistente sin que nada falle de forma visible.
 */
const PACKAGE = 'com.jordufi.storyplanner';

/** Ficha en el navegador: sirve también de respaldo si no hay Play Store. */
export const STORE_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}`;

/**
 * `market://` abre la app de Play Store directamente en la ficha, con el
 * diálogo de valoración a un toque. Sólo lo entiende Android y sólo si Play
 * está instalado (un emulador sin Google Play, por ejemplo, no).
 */
const MARKET_URL = `market://details?id=${PACKAGE}`;

/**
 * Política de privacidad y condiciones de uso. Es el mismo `PRIVACY.md` del
 * repositorio que se declara en Play Console: un único sitio que mantener.
 */
export const PRIVACY_URL = 'https://github.com/jordufi/book_helper/blob/main/PRIVACY.md';

/**
 * Abre una URL fuera de la app. Devuelve `false` en vez de lanzar: quien
 * llama decide qué contar al usuario (aquí, enseñarle la URL para que la
 * abra a mano), porque un enlace que no abre no es motivo para romper la
 * pantalla de Ajustes.
 */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Ficha de la tienda, con la app de Play Store por delante del navegador. */
export async function openStoreListing(): Promise<boolean> {
  if (Platform.OS === 'android' && (await openExternal(MARKET_URL))) return true;
  return openExternal(STORE_URL);
}
