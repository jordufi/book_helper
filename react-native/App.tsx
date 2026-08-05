import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';

import { getDb } from './src/db/database';
import { ActiveBookProvider } from './src/state/useActiveBook';
import type { CharactersStackParams, ChaptersStackParams } from './src/navigation';
import { useTheme } from './src/ui/theme';
import { ErrorBanner, Spinner } from './src/ui/components';
import { BooksScreen } from './src/screens/BooksScreen';
import { PlotScreen } from './src/screens/PlotScreen';
import { CharactersScreen } from './src/screens/CharactersScreen';
import { CharacterDetailScreen } from './src/screens/CharacterDetailScreen';
import { ChaptersScreen } from './src/screens/ChaptersScreen';
import { ChapterDetailScreen } from './src/screens/ChapterDetailScreen';

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
  return (
    <CharactersStack.Navigator>
      <CharactersStack.Screen
        name="CharactersList"
        component={CharactersScreen}
        options={{ title: 'Personajes' }}
      />
      <CharactersStack.Screen
        name="CharacterDetail"
        component={CharacterDetailScreen}
        options={{ title: 'Ficha' }}
      />
    </CharactersStack.Navigator>
  );
}

function ChaptersNavigator() {
  return (
    <ChaptersStack.Navigator>
      <ChaptersStack.Screen
        name="ChaptersList"
        component={ChaptersScreen}
        options={{ title: 'Capítulos' }}
      />
      <ChaptersStack.Screen
        name="ChapterDetail"
        component={ChapterDetailScreen}
        options={{ title: 'Capítulo' }}
      />
    </ChaptersStack.Navigator>
  );
}

/** Emoji como icono de pestaña: evita arrastrar una librería de iconos entera. */
function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{icon}</Text>;
}

export default function App() {
  const scheme = useColorScheme();
  const theme = useTheme();
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
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            backgroundColor: theme.bg,
          }}
        >
          <Spinner label="Abriendo la biblioteca…" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
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
                  tabBarIcon: ({ color }) => <TabIcon icon="📚" color={color} />,
                }}
              />
              <Tabs.Screen
                name="Trama"
                component={PlotScreen}
                options={{
                  tabBarIcon: ({ color }) => <TabIcon icon="🧵" color={color} />,
                }}
              />
              <Tabs.Screen
                name="Personajes"
                component={CharactersNavigator}
                options={{
                  headerShown: false,
                  tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} />,
                }}
              />
              <Tabs.Screen
                name="Capítulos"
                component={ChaptersNavigator}
                options={{
                  headerShown: false,
                  tabBarIcon: ({ color }) => <TabIcon icon="📖" color={color} />,
                }}
              />
            </Tabs.Navigator>
          </NavigationContainer>
        </ActiveBookProvider>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
