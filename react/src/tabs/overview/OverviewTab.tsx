import { useMemo } from 'react';
import { fileUrl } from '../../api/client';
import { useCharacters, useChapters, usePlot } from '../../api/hooks';
import { Avatar, ErrorBanner, Section, Spinner } from '../../components/ui';
import { downloadTextFile, slugify } from '../../lib/downloadFile';
import { ROLE_LABELS, type Book } from '../../types';
import { overviewToMarkdown } from './overviewToMarkdown';

/** Promesa reducida a lo que necesita un badge de la línea de tiempo. */
interface PromiseBadge {
  id: string;
  title: string;
}

/**
 * Resumen de sólo lectura del libro entero: trama, personajes y capítulos en
 * una sola pantalla, sin nada que editar. Reutiliza los datos ya cacheados
 * por las otras tabs (misma clave de react-query), no dispara peticiones
 * nuevas si ya se visitó Trama/Personajes/Capítulos.
 */
export function OverviewTab({ bookId, book }: { bookId: string | null; book: Book | null }) {
  const characters = useCharacters(bookId);
  const chapters = useChapters(bookId);
  const plot = usePlot(bookId);

  // Por suceso: qué promesas se siembran ahí y cuáles se pagan ahí. Mismo
  // cálculo que PlotTimeline, pero aquí es sólo lectura. Se guarda el id
  // además del título porque el título NO es único y es la key de React.
  const promisesByEvent = useMemo(() => {
    const map = new Map<string, { seeds: PromiseBadge[]; payoffs: PromiseBadge[] }>();
    const entry = (id: string) => {
      if (!map.has(id)) map.set(id, { seeds: [], payoffs: [] });
      return map.get(id)!;
    };
    for (const p of plot.data?.promises ?? []) {
      entry(p.setupEventId).seeds.push({ id: p.id, title: p.title });
      if (p.payoffEventId) entry(p.payoffEventId).payoffs.push({ id: p.id, title: p.title });
    }
    return map;
  }, [plot.data?.promises]);

  if (!bookId) {
    return (
      <div className="placeholder">
        <h1>Sin libro</h1>
        <p>Crea un libro arriba para ver aquí su resumen.</p>
      </div>
    );
  }

  if (characters.isLoading || chapters.isLoading || plot.isLoading) return <Spinner />;
  const error = characters.error ?? chapters.error ?? plot.error;
  if (error) return <ErrorBanner error={error} />;

  const characterList = characters.data ?? [];
  const chapterList = chapters.data ?? [];
  const events = plot.data?.events ?? [];
  const promises = plot.data?.promises ?? [];
  const pending = promises.filter((p) => !p.payoffEventId).length;

  const exportMarkdown = () => {
    const markdown = overviewToMarkdown({ book, events, promises, characters: characterList, chapters: chapterList });
    downloadTextFile(`${slugify(book?.title ?? 'libro')}.md`, markdown, 'text/markdown');
  };

  return (
    <div>
      <div className="grid-head" style={{ marginBottom: 12 }}>
        <span className="grid-count">Resumen de sólo lectura</span>
        <button className="btn btn-sm" onClick={exportMarkdown}>
          Exportar como Markdown
        </button>
      </div>

      <div className="detail">
        <Section title={`Trama — ${events.length} ${events.length === 1 ? 'suceso' : 'sucesos'}, ${pending} de ${promises.length} promesas sin pagar`}>
          {events.length === 0 ? (
            <p className="empty-note">Todavía no hay sucesos en la trama.</p>
          ) : (
            <div className="timeline">
              {events.map((e, i) => {
                const badges = promisesByEvent.get(e.id);
                return (
                  <div className="timeline-item" key={e.id}>
                    <div className="timeline-rail">
                      <div className="timeline-dot" />
                      {i < events.length - 1 && <div className="timeline-line" />}
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-title">{e.title}</div>
                      {e.description && <div className="prose">{e.description}</div>}
                      {badges && (badges.seeds.length > 0 || badges.payoffs.length > 0) && (
                        <div className="event-promises">
                          {badges.seeds.map((p) => (
                            <span key={`seed-${p.id}`} className="badge badge-pending">
                              siembra: {p.title}
                            </span>
                          ))}
                          {badges.payoffs.map((p) => (
                            <span key={`payoff-${p.id}`} className="badge badge-paid">
                              paga: {p.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title={`Personajes — ${characterList.length}`}>
          {characterList.length === 0 ? (
            <p className="empty-note">Todavía no hay personajes en este libro.</p>
          ) : (
            <div className="card-list">
              {characterList.map((c) => (
                <div className="list-card" key={c.id}>
                  <Avatar src={fileUrl(c.photoUrl)} name={c.name} />
                  <div className="list-card-body">
                    <div className="list-card-title">{c.name}</div>
                    <div className="list-card-meta">
                      <span className={`badge badge-${c.role}`}>{ROLE_LABELS[c.role]}</span>
                      {c.age && ` · ${c.age}`}
                      {c.arcSummary && ` · ${c.arcSummary}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Capítulos — ${chapterList.length}`}>
          {chapterList.length === 0 ? (
            <p className="empty-note">Todavía no hay capítulos en este libro.</p>
          ) : (
            <div className="card-list">
              {chapterList.map((c) => (
                <div className="list-card" key={c.id}>
                  <div className="chapter-num">{c.position + 1}</div>
                  <div className="list-card-body">
                    <div className="list-card-title">{c.title}</div>
                    <div className="list-card-meta">
                      {c.synopsis && <span>{c.synopsis}</span>}
                      {c.synopsis && ' · '}
                      {c._count.cast} {c._count.cast === 1 ? 'personaje' : 'personajes'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
