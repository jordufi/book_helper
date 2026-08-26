import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { dictionaries, type Dict, type Locale } from '../i18n';

const LOCALE_KEY = 'story-planner:idioma';
const THEME_KEY = 'story-planner:tema';

export type ThemeMode = 'light' | 'dark' | 'system';

const DEFAULT_LOCALE: Locale = 'es';
const DEFAULT_THEME_MODE: ThemeMode = 'system';

interface SettingsValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'es' || value === 'en';
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Ajustes de la app: idioma y tema. Mismo patrón que `ActiveBookProvider`
 * (Context + persistencia en `expo-sqlite/kv-store`), y por el mismo motivo:
 * es estado propio de la app, no algo que viva en la BD de books/characters,
 * y varias pantallas montadas a la vez (pestañas) necesitan verlo cambiar a
 * la vez.
 *
 * No bloquea el primer render a la espera de leer el storage —igual que
 * `ActiveBookProvider`—: se pinta con los valores por defecto y, si había
 * algo guardado, se actualiza un instante después. Los defaults
 * (`es`/`system`) son exactamente el comportamiento de la app ANTES de que
 * existiera esta pantalla, así que ese primer instante no se nota.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);

  useEffect(() => {
    let cancelled = false;
    Storage.getItem(LOCALE_KEY).then((stored) => {
      if (!cancelled && isLocale(stored)) setLocaleState(stored);
    });
    Storage.getItem(THEME_KEY).then((stored) => {
      if (!cancelled && isThemeMode(stored)) setThemeModeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    void Storage.setItem(LOCALE_KEY, next);
  };

  const setThemeMode = (next: ThemeMode) => {
    setThemeModeState(next);
    void Storage.setItem(THEME_KEY, next);
  };

  const value = useMemo<SettingsValue>(
    () => ({ locale, setLocale, themeMode, setThemeMode }),
    [locale, themeMode],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings debe usarse dentro de <SettingsProvider>');
  return value;
}

/** Diccionario del idioma activo. Se usa en vez de literales en toda la UI. */
export function useT(): Dict {
  const { locale } = useSettings();
  return dictionaries[locale];
}

/**
 * Tema ya resuelto a 'light'/'dark'. Con `themeMode === 'system'` cae al
 * color scheme del dispositivo (comportamiento de la app antes de que
 * existiera este ajuste); si no, devuelve el valor fijado por el usuario.
 */
export function useThemeScheme(): 'light' | 'dark' {
  const { themeMode } = useSettings();
  const system = useColorScheme();
  if (themeMode === 'system') return system === 'dark' ? 'dark' : 'light';
  return themeMode;
}
