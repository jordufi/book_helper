import { useCallback } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../state/useSettings';

/**
 * Pide confirmación antes de cerrar la app con el botón atrás de Android.
 *
 * Se usa sólo en la pantalla de inicio (`BooksScreen`), que es la única desde
 * la que el atrás sale de la app: en el resto de pestañas React Navigation lo
 * usa para volver aquí, y en las fichas para volver a su lista. Por eso va
 * dentro de `useFocusEffect` — el listener se registra al enfocar la pestaña y
 * se retira al salir de ella, en vez de quedarse activo mientras la pantalla
 * siga montada (las pestañas no se desmontan al cambiar de una a otra).
 *
 * Nuestro listener se registra después que el de React Navigation y BackHandler
 * los recorre en orden inverso, así que devolviendo `true` gana este y el atrás
 * no llega a cerrar nada.
 *
 * `enabled` existe para desactivarlo mientras hay un `Modal` encima (los
 * formularios de libro, el tutorial): ahí el atrás debe cerrar ese modal, no
 * preguntar por la salida de la app.
 *
 * En iOS no hay botón atrás de sistema; allí `BackHandler` es un no-op y este
 * hook simplemente no hace nada.
 */
export function useExitConfirm(enabled: boolean = true) {
  const i18n = useT();

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(i18n.exit.title, i18n.exit.message, [
          { text: i18n.exit.cancel, style: 'cancel' },
          { text: i18n.exit.confirm, style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      });

      return () => subscription.remove();
    }, [enabled, i18n]),
  );
}
