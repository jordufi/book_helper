import { ROLE_LABELS, type Book, type ChapterSummary, type CharacterSummary, type PlotEvent, type PlotPromise } from '../../types';

/**
 * Convierte a Markdown exactamente lo que se ve en la tab Libro: trama,
 * personajes y capítulos, con los mismos campos y el mismo orden. No añade
 * información que no esté ya visible ahí (personalidad, texto de capítulos…),
 * porque el botón exporta "esto", no una ficha completa.
 */
export function overviewToMarkdown({
  book,
  events,
  promises,
  characters,
  chapters,
}: {
  book: Book | null;
  events: PlotEvent[];
  promises: PlotPromise[];
  characters: CharacterSummary[];
  chapters: ChapterSummary[];
}): string {
  const lines: string[] = [];

  lines.push(`# ${book?.title ?? 'Libro'}`);
  if (book?.author) lines.push(`*${book.author}*`);
  lines.push('');

  const promisesByEvent = new Map<string, { seeds: string[]; payoffs: string[] }>();
  const entry = (id: string) => {
    if (!promisesByEvent.has(id)) promisesByEvent.set(id, { seeds: [], payoffs: [] });
    return promisesByEvent.get(id)!;
  };
  for (const p of promises) {
    entry(p.setupEventId).seeds.push(p.title);
    if (p.payoffEventId) entry(p.payoffEventId).payoffs.push(p.title);
  }
  const pending = promises.filter((p) => !p.payoffEventId).length;

  lines.push('## Trama');
  lines.push('');
  lines.push(
    `_${events.length} ${events.length === 1 ? 'suceso' : 'sucesos'}, ${pending} de ${promises.length} promesas sin pagar_`,
  );
  lines.push('');
  if (events.length === 0) {
    lines.push('_Todavía no hay sucesos en la trama._');
  } else {
    for (const [i, e] of events.entries()) {
      lines.push(`${i + 1}. **${e.title}**`);
      if (e.description) lines.push(`   ${e.description}`);
      const badges = promisesByEvent.get(e.id);
      for (const title of badges?.seeds ?? []) lines.push(`   - siembra: ${title}`);
      for (const title of badges?.payoffs ?? []) lines.push(`   - paga: ${title}`);
    }
  }
  lines.push('');

  lines.push('## Personajes');
  lines.push('');
  if (characters.length === 0) {
    lines.push('_Todavía no hay personajes en este libro._');
  } else {
    for (const c of characters) {
      const meta = [ROLE_LABELS[c.role], c.age, c.arcSummary].filter(Boolean).join(' · ');
      lines.push(`- **${c.name}** — ${meta}`);
    }
  }
  lines.push('');

  lines.push('## Capítulos');
  lines.push('');
  if (chapters.length === 0) {
    lines.push('_Todavía no hay capítulos en este libro._');
  } else {
    for (const c of chapters) {
      const cast = `${c._count.cast} ${c._count.cast === 1 ? 'personaje' : 'personajes'}`;
      lines.push(`${c.position + 1}. **${c.title}**${c.synopsis ? ` — ${c.synopsis}` : ''} (${cast})`);
    }
  }
  lines.push('');

  return lines.join('\n');
}
