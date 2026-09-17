import { Alert, View } from 'react-native';
import { Button, Choice, Field, Screen, ScreenScroll, Title } from '../ui/components';
import { SPACING } from '../ui/theme';
import { useSettings, useT, type ThemeMode } from '../state/useSettings';
import { useWalkthrough } from '../state/useWalkthrough';
import { PRIVACY_URL, STORE_URL, openExternal, openStoreListing } from '../lib/links';
import type { Locale } from '../i18n';

/**
 * Sin guardado explícito: cada opción escribe directo en `SettingsProvider`
 * (Context + `expo-sqlite/kv-store`), y toda la app —incluida esta misma
 * pantalla— se repinta al instante porque `useT()`/`useThemeScheme()` leen
 * de ese mismo Context.
 */
export function SettingsScreen() {
  const i18n = useT();
  const { themeMode, setThemeMode, locale, setLocale } = useSettings();
  const walkthrough = useWalkthrough();

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: i18n.settings.themeLight },
    { value: 'dark', label: i18n.settings.themeDark },
    { value: 'system', label: i18n.settings.themeSystem },
  ];

  const localeOptions: { value: Locale; label: string }[] = [
    { value: 'es', label: i18n.settings.languageEs },
    { value: 'en', label: i18n.settings.languageEn },
    { value: 'fr', label: i18n.settings.languageFr },
  ];

  /**
   * Un enlace que no abre (un dispositivo sin navegador, un intent bloqueado)
   * no debe quedarse en un toque que no hace nada: se enseña la URL para poder
   * abrirla a mano. La URL que se enseña es siempre la `https`, no el
   * `market://` de `openStoreListing`, que no se puede pegar en un navegador.
   */
  const open = (shownUrl: string, run: () => Promise<boolean>) => {
    void run().then((ok) => {
      if (!ok) Alert.alert(i18n.settings.linkErrorTitle, i18n.settings.linkErrorBody(shownUrl));
    });
  };

  return (
    <Screen>
      <ScreenScroll contentContainerStyle={{ padding: SPACING + 4, gap: SPACING + 8 }}>
        <Title>{i18n.settings.title}</Title>

        <Field label={i18n.settings.themeLabel}>
          <Choice value={themeMode} options={themeOptions} onChange={setThemeMode} />
        </Field>

        <Field label={i18n.settings.languageLabel}>
          <Choice value={locale} options={localeOptions} onChange={setLocale} />
        </Field>

        <Field label={i18n.settings.aboutLabel}>
          <View style={{ gap: 8 }}>
            <Button label={i18n.settings.rateApp} onPress={() => open(STORE_URL, openStoreListing)} />
            <Button
              label={i18n.settings.privacyPolicy}
              onPress={() => open(PRIVACY_URL, () => openExternal(PRIVACY_URL))}
            />
            <Button label={i18n.settings.showWalkthrough} onPress={walkthrough.open} />
          </View>
        </Field>
      </ScreenScroll>
    </Screen>
  );
}
