import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS, type ChapterId } from '../content/types';
import { content, conceptById, CHAPTER_SHORT } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { record } from '../lib/store';
import { seenConcepts } from '../lib/stats';
import { cardId, cardQueue, cardStates, type CardRating } from '../lib/drills';

interface Card {
  id: string;
  conceptId: string;
  term: string;
  def: string;
}

const ALL_CARDS: Card[] = content.chapters.flatMap((ch) =>
  ch.conceptIds.flatMap((cid) => (conceptById.get(cid)?.terms ?? []).map((t, i) => ({ id: cardId(cid, i), conceptId: cid, term: t.term, def: t.def }))),
);
const CARD_BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));

/** Key-term flashcards with Leitner spacing: Again (10 min) · Good (+1 box) · Easy (+2 boxes). */
export default function Flashcards() {
  const attempts = useAttempts();
  const [chapter, setChapter] = useState<ChapterId | 'all'>('all');
  const [seenOnly, setSeenOnly] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [skip, setSkip] = useState<string[]>([]); // rated this session ("again" cards return after 10 min)

  const seen = useMemo(() => seenConcepts(attempts), [attempts]);
  const states = useMemo(() => cardStates(attempts), [attempts]);
  const deck = ALL_CARDS.filter((c) => (chapter === 'all' || conceptById.get(c.conceptId)?.chapter === chapter) && (!seenOnly || seen.has(c.conceptId)));
  const queue = cardQueue(deck.map((c) => c.id), states, Date.now()).filter((id) => !skip.includes(id));
  const card = queue[0] ? CARD_BY_ID.get(queue[0]) : undefined;
  const dueCount = deck.filter((c) => states.has(c.id) && states.get(c.id)!.due <= Date.now()).length;
  const learned = deck.filter((c) => (states.get(c.id)?.box ?? 0) >= 3).length;

  const rate = (r: CardRating) => {
    if (!card) return;
    record({ questionId: card.id, conceptIds: [], correct: true, confidence: null, mode: 'flashcard', meta: { rating: r, concept: card.conceptId } });
    setSkip((s) => [...s, card.id]);
    setFlipped(false);
    setSessionCount((n) => n + 1);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === '1') rate('again');
      else if (flipped && e.key === '2') rate('good');
      else if (flipped && e.key === '3') rate('easy');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const front = card ? (reverse ? card.def : card.term) : '';
  const back = card ? (reverse ? card.term : card.def) : '';
  const concept = card ? conceptById.get(card.conceptId) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold">🃏 Flashcards</h1>
          <p className="text-xs text-slate-500">{deck.length} cards · {dueCount} due · {learned} learned · {sessionCount} reviewed now</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', ...CHAPTERS] as const).map((c) => (
            <button key={c} onClick={() => { setChapter(c); setSkip([]); }} className={`chip shrink-0 border px-3 py-1 ${chapter === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
              {c === 'all' ? 'All chapters' : `Ch ${c} · ${CHAPTER_SHORT[c]}`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={seenOnly} onChange={(e) => { setSeenOnly(e.target.checked); setSkip([]); }} /> Only concepts I've seen</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> Definition first</label>
        </div>
      </div>

      {!card ? (
        <div className="card space-y-2 text-center">
          <p className="text-4xl">🎉</p>
          <p className="font-semibold">{deck.length ? 'Nothing due right now.' : 'No cards here yet.'}</p>
          <p className="text-sm text-slate-500">
            {deck.length ? 'Cards you rated come back on their schedule (Again: 10 min, Good: ½–8 days).' : seenOnly ? 'Finish a lesson first, or untick “Only concepts I’ve seen”.' : ''}
          </p>
          {skip.length > 0 && <button className="btn-ghost" onClick={() => setSkip([])}>Keep going with rated cards</button>}
        </div>
      ) : (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className={`card flex min-h-[14rem] w-full flex-col items-center justify-center gap-3 text-center transition ${flipped ? 'bg-brand-50 dark:bg-brand-700/10' : ''}`}
            aria-label={flipped ? 'Card back' : 'Card front — tap to flip'}
          >
            <span className="text-xs text-slate-500">Ch {concept?.chapter} · {concept?.title}</span>
            <span className={`${reverse && !flipped ? 'text-base' : 'text-xl font-bold'} leading-relaxed`}>{front}</span>
            {flipped ? <span className={`${reverse ? 'text-xl font-bold' : 'text-base'} border-t border-slate-200 pt-3 text-slate-700 dark:border-slate-700 dark:text-slate-200`}>{back}</span> : <span className="text-xs text-slate-400">Tap or press Space to flip</span>}
          </button>
          {flipped ? (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => rate('again')}>Again <span className="hidden opacity-70 sm:inline">(1)</span></button>
              <button className="btn bg-brand-600 text-white hover:bg-brand-700" onClick={() => rate('good')}>Good <span className="hidden opacity-70 sm:inline">(2)</span></button>
              <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => rate('easy')}>Easy <span className="hidden opacity-70 sm:inline">(3)</span></button>
            </div>
          ) : (
            <button className="btn-primary w-full" onClick={() => setFlipped(true)}>Show answer</button>
          )}
          {concept && <p className="text-center text-xs"><Link className="text-brand-600 hover:underline" to={`/lesson/${concept.id}`}>Open the full lesson</Link> · {concept.src}</p>}
        </>
      )}
    </div>
  );
}
