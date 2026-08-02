import { BookSelector } from './components/BookSelector';
import { ErrorBanner, Spinner } from './components/ui';
import { TABS, TAB_LABELS, useRoute } from './lib/useRoute';
import { useActiveBook } from './state/useActiveBook';
import { PlaceholderTab } from './tabs/PlaceholderTab';
import { CharactersTab } from './tabs/characters/CharactersTab';

export default function App() {
  const [route, navigate] = useRoute();
  const { books, bookId, setBookId, isLoading, error } = useActiveBook();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Book<span>Helper</span>
        </div>
        <BookSelector books={books} bookId={bookId} onSelect={setBookId} />
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            className="tab"
            role="tab"
            aria-selected={route.tab === tab}
            onClick={() => navigate({ tab })}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <main className="content">
        {error ? (
          <ErrorBanner error={error} />
        ) : isLoading ? (
          <Spinner />
        ) : route.tab === 'personajes' ? (
          <CharactersTab
            bookId={bookId}
            characterId={route.characterId}
            onSelect={(characterId) => navigate({ characterId })}
          />
        ) : route.tab === 'trama' ? (
          <PlaceholderTab title="Trama" note="Esta sección aún no está implementada." />
        ) : (
          <PlaceholderTab title="Capítulos" note="Esta sección aún no está implementada." />
        )}
      </main>
    </div>
  );
}
