import { BookSelector } from './components/BookSelector';
import { ErrorBanner, Spinner } from './components/ui';
import { TABS, TAB_LABELS, useRoute } from './lib/useRoute';
import { useActiveBook } from './state/useActiveBook';
import { CharactersTab } from './tabs/characters/CharactersTab';
import { ChaptersTab } from './tabs/chapters/ChaptersTab';
import { PlotTab } from './tabs/plot/PlotTab';

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
            characterId={route.itemId}
            onSelect={(itemId) => navigate({ itemId })}
          />
        ) : route.tab === 'capitulos' ? (
          <ChaptersTab
            bookId={bookId}
            chapterId={route.itemId}
            onSelect={(itemId) => navigate({ itemId })}
          />
        ) : (
          <PlotTab bookId={bookId} />
        )}
      </main>
    </div>
  );
}
