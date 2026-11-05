import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChapterId } from '../content/types';
import { content, conceptById } from '../lib/content';
import { useAttempts } from '../lib/hooks';
import { record } from '../lib/store';
import { seenConcepts } from '../lib/stats';
import { ChapterChip, ChapterTabs, TAB } from '../components/ui';
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-[26px] font-extrabold leading-tight">Flashcards</h1>
          <p className="text-[13px] text-pencil">{deck.length} cards, {dueCount} due now, {learned} learned{sessionCount ? `, ${sessionCount} reviewed this session` : ''}</p>
        </div>
        <ChapterTabs all active={chapter} onSelect={(c) => { setChapter(c); setSkip([]); }} />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={seenOnly} onChange={(e) => { setSeenOnly(e.target.checked); setSkip([]); }} /> Only concepts I've seen</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> Definition first</label>
        </div>
      </div>

      {!card ? (
        <div className="card space-y-2 text-center">
          <p className="text-4xl">🎉</p>
          <p className="font-semibold">{deck.length ? 'Nothing due right now.' : 'No cards here yet.'}</p>
          <p className="text-sm text-pencil">
            {deck.length ? 'Cards you rated come back on their schedule (Again: 10 min, Good: ½–8 days).' : seenOnly ? 'Finish a lesson first, or untick “Only concepts I’ve seen”.' : ''}
          </p>
          {skip.length > 0 && <button className="btn-ghost" onClick={() => setSkip([])}>Keep going with rated cards</button>}
        </div>
      ) : (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-[15rem] w-full flex-col items-center justify-center gap-4 rounded-md border border-rule bg-sheet p-6 text-center shadow-[0_10px_24px_-18px_rgb(0_0_0/0.45)]"
            style={concept ? { borderTop: `8px solid ${TAB[concept.chapter]}` } : undefined}
            aria-label={flipped ? 'Card back' : 'Card front, tap to flip'}
          >
            {concept && <ChapterChip ch={concept.chapter} title={concept.title} />}
            <span className={reverse && !flipped ? 'max-w-[52ch] font-serif text-[17px] leading-relaxed' : 'text-[26px] font-extrabold leading-tight'}>{reverse ? front : <span className={flipped ? 'hl' : ''}>{front}</span>}</span>
            {flipped ? <span className={`${reverse ? 'text-[26px] font-extrabold leading-tight' : 'max-w-[52ch] font-serif text-[17px] leading-relaxed'} w-full border-t border-dashed border-rule pt-4`}>{back}</span> : <span className="text-[13px] text-pencil">Tap or press Space to flip</span>}
          </button>
          {flipped ? (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-ghost text-redpen" onClick={() => rate('again')}>Again <kbd className="hidden sm:inline">1</kbd></button>
              <button className="btn-primary" onClick={() => rate('good')}>Good <kbd className="hidden border-transparent bg-transparent text-sheet/70 sm:inline">2</kbd></button>
              <button className="btn-ghost text-tick" onClick={() => rate('easy')}>Easy <kbd className="hidden sm:inline">3</kbd></button>
            </div>
          ) : (
            <button className="btn-primary w-full" onClick={() => setFlipped(true)}>Show answer</button>
          )}
          {concept && <p className="text-center text-xs"><Link className="text-[15px] text-pencil hover:text-ink" to={`/lesson/${concept.id}`}>Open the full lesson</Link> · {concept.src}</p>}
        </>
      )}
    </div>
  );
}
