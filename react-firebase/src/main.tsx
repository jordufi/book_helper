import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initStore } from './store/store';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sin red que cachear: los datos sólo cambian cuando una mutación local
      // los toca y ella misma actualiza la caché (setQueryData/invalidate).
      // "Obsoleto" no significa nada aquí, así que nunca lo están solas.
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
    },
  },
});

/**
 * Hidratar antes de montar, no en un efecto dentro de App: `useActiveBook`
 * (state/useActiveBook.ts, sin tocar) descarta el libro guardado en
 * localStorage en cuanto ve `useBooks()` devolver una lista que no lo
 * contiene. Si el primer render ocurriera con el store todavía vacío, ese
 * efecto borraría el libro activo en cada recarga de la página.
 */
initStore().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
});
