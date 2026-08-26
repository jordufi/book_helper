import { Choice, Field, Screen, ScreenScroll, Title } from '../ui/components';
import { SPACING } from '../ui/theme';
import { useSettings, useT, type ThemeMode } from '../state/useSettings';
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

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: i18n.settings.themeLight },
    { value: 'dark', label: i18n.settings.themeDark },
    { value: 'system', label: i18n.settings.themeSystem },
  ];

  const localeOptions: { value: Locale; label: string }[] = [
    { value: 'es', label: i18n.settings.languageEs },
    { value: 'en', label: i18n.settings.languageEn },
  ];

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
      </ScreenScroll>
    </Screen>
  );
}
