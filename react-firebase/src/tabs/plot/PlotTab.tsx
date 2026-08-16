import { usePlot } from '../../api/hooks';
import { ErrorBanner, Spinner } from '../../components/ui';
import { PlotTimeline } from './PlotTimeline';
import { PromisesPanel } from './PromisesPanel';

export function PlotTab({ bookId }: { bookId: string | null }) {
  const { data: plot, isLoading, error } = usePlot(bookId);

  if (!bookId) {
    return (
      <div className="placeholder">
        <h1>Sin libro</h1>
        <p>Crea un libro arriba para empezar a diseñar su trama.</p>
      </div>
    );
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;
  if (!plot) return null;

  return (
    <div className="plot-layout">
      <PlotTimeline plot={plot} bookId={bookId} />
      <aside className="plot-side">
        <PromisesPanel plot={plot} bookId={bookId} />
      </aside>
    </div>
  );
}
