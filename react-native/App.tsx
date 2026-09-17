import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getDb } from './src/db/database';
import { ActiveBookProvider } from './src/state/useActiveBook';
import { SettingsProvider, useT, useThemeScheme } from './src/state/useSettings';
import { WalkthroughProvider } from './src/state/useWalkthrough';
import type { CharactersStackParams, ChaptersStackParams } from './src/navigation';
import { useTheme } from './src/ui/theme';
import { ErrorBanner, Spinner } from './src/ui/components';
import { Walkthrough } from './src/ui/Walkthrough';
import { BooksScreen } from './src/screens/BooksScreen';
import { PlotScreen } from './src/screens/PlotScreen';
import { CharactersScreen } from './src/screens/CharactersScreen';
import { CharacterDetailScreen } from './src/screens/CharacterDetailScreen';
import { ChaptersScreen } from './src/screens/ChaptersScreen';
import { ChapterDetailScreen } from './src/screens/ChapterDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos son locales y sólo cambian por acciones del propio usuario:
      // no hace falta refrescar al volver a la app.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 0,
    },
  },
});

const Tabs = createBottomTabNavigator();
const CharactersStack = createNativeStackNavigator<CharactersStackParams>();
const ChaptersStack = createNativeStackNavigator<ChaptersStackParams>();

function CharactersNavigator() {
  const i18n = useT();
  return (
    <CharactersStack.Navigator>
      <CharactersStack.Screen
        name="CharactersList"
        component={CharactersScreen}
        options={{ title: i18n.tabs.characters }}
      />
      <CharactersStack.Screen
        name="CharacterDetail"
        component={CharacterDetailScreen}
        options={{ title: i18n.tabs.characterDetail }}
      />
    </CharactersStack.Navigator>
  );
}

function ChaptersNavigator() {
  const i18n = useT();
  return (
    <ChaptersStack.Navigator>
      <ChaptersStack.Screen
        name="ChaptersList"
        component={ChaptersScreen}
        options={{ title: i18n.tabs.chapters }}
      />
      <ChaptersStack.Screen
        name="ChapterDetail"
        component={ChapterDetailScreen}
        options={{ title: i18n.tabs.chapterDetail }}
      />
    </ChaptersStack.Navigator>
  );
}

/** Emoji como icono de pestaña: evita arrastrar una librería de iconos entera. */
function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{icon}</Text>;
}

/**
 * Cuerpo real de la app, separado del `export default` para que
 * `SettingsProvider` pueda envolverlo entero —incluidas las pantallas de
 * carga y error de más abajo—. Esas pantallas usan `useTheme()`/`useT()`, que
 * ahora dependen del Context de ajustes: si `SettingsProvider` sólo envolviera
 * la rama "todo listo" (como hacía `ActiveBookProvider`, que sí puede esperar
 * porque depende de react-query), esos hooks fallarían mientras la BD
 * principal todavía se está abriendo. `SettingsProvider` no tiene ese
 * problema: usa su propio kv-store, independiente de `getDb()`.
 */
function AppShell() {
  const scheme = useThemeScheme();
  const theme = useTheme();
  const i18n = useT();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // La BD se abre y migra una sola vez, antes de pintar nada: si falla, más
  // vale decirlo que dejar cada pantalla fallando por su cuenta.
  useEffect(() => {
    getDb()
      .then(() => setReady(true))
      .catch(setError);
  }, []);

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 20,
          backgroundColor: theme.bg,
        }}
      >
        <ErrorBanner error={error} />
      </View>
    );
  }

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: theme.bg,
        }}
      >
        <Spinner label={i18n.app.openingLibrary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* Dentro del QueryClientProvider: el proveedor usa useBooks(). Y por
          fuera de la navegación, para que TODAS las pestañas compartan el
          mismo libro activo aunque se queden montadas. */}
      <ActiveBookProvider>
        <NavigationContainer
          theme={{
            ...navTheme,
            colors: {
              ...navTheme.colors,
              background: theme.bg,
              card: theme.surface,
              text: theme.text,
              border: theme.border,
              primary: theme.accent,
            },
          }}
        >
          <Tabs.Navigator
            screenOptions={{
              tabBarActiveTintColor: theme.accent,
              tabBarInactiveTintColor: theme.textDim,
            }}
          >
            <Tabs.Screen
              name="Libros"
              component={BooksScreen}
              options={{
                title: i18n.tabs.books,
                tabBarLabel: i18n.tabs.books,
                tabBarIcon: ({ color }) => <TabIcon icon="📚" color={color} />,
              }}
            />
            <Tabs.Screen
              name="Trama"
              component={PlotScreen}
              options={{
                title: i18n.tabs.plot,
                tabBarLabel: i18n.tabs.plot,
                tabBarIcon: ({ color }) => <TabIcon icon="🧵" color={color} />,
              }}
            />
            <Tabs.Screen
              name="Personajes"
              component={CharactersNavigator}
              options={{
                headerShown: false,
                tabBarLabel: i18n.tabs.characters,
                tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} />,
              }}
            />
            <Tabs.Screen
              name="Capítulos"
              component={ChaptersNavigator}
              options={{
                headerShown: false,
                tabBarLabel: i18n.tabs.chapters,
                tabBarIcon: ({ color }) => <TabIcon icon="📖" color={color} />,
              }}
            />
            <Tabs.Screen
              name="Ajustes"
              component={SettingsScreen}
              options={{
                title: i18n.tabs.settings,
                tabBarLabel: i18n.tabs.settings,
                tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} />,
              }}
            />
          </Tabs.Navigator>
        </NavigationContainer>
      </ActiveBookProvider>
      {/* Fuera de NavigationContainer y por encima de todo: el tutorial sale
          también en el primer arranque, cuando todavía no hay ningún libro y
          ninguna pestaña tiene nada que enseñar. */}
      <Walkthrough />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <WalkthroughProvider>
          <AppShell />
        </WalkthroughProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
