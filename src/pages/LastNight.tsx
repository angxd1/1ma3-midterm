import { useEffect, useMemo } from 'react';
import { content, conceptById, mcqById, owedMcqs, CHAPTER_SHORT } from '../lib/content';
import { useAttempts, useSettings } from '../lib/hooks';
import { conceptReadiness } from '../lib/readiness';
import { seenConcepts } from '../lib/stats';

/**
 * A printable one-stop review sheet for the night before: your weakest
 * concepts, owed mistakes, confusable-pair tips, Ch 4 short-answer outlines and
 * every key term. "Save as PDF" goes through the browser's print dialog.
 */
export default function LastNight() {
  const attempts = useAttempts();
  const { examDate } = useSettings();

  // Print in light colours even when the app is in dark mode.
  useEffect(() => {
    let wasDark = false;
    const before = () => {
      wasDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.remove('dark');
    };
    const after = () => wasDark && document.documentElement.classList.add('dark');
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const { weak, unseen, owed } = useMemo(() => {
    const p = conceptReadiness(attempts, Date.now());
    const seen = seenConcepts(attempts);
    const all = content.chapters.flatMap((c) => c.conceptIds);
    return {
      weak: all.filter((c) => p.has(c)).sort((a, b) => p.get(a)! - p.get(b)!).slice(0, 10),
      unseen: all.filter((c) => !seen.has(c)),
      owed: owedMcqs(attempts).slice(0, 20),
    };
  }, [attempts]);

  const date = new Date(examDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const ch4Sas = content.shortAnswers.filter((s) => s.chapter === 4);

  return (
    <div className="mx-auto max-w-4xl space-y-5 print:max-w-none print:space-y-3 print:text-[10.5pt]">
      <div className="card flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight">Last-night review sheet</h1>
          <p className="text-sm text-pencil">Personalised from your progress. Use “Save as PDF” in the print dialog to keep a copy on your phone.</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>Download PDF / print</button>
      </div>

      <section className="space-y-1">
        <h1 className="text-2xl font-extrabold">COMMERCE 1MA3 midterm, {date}</h1>
        <p className="text-sm">60 multiple-choice and 2 short-answer questions in 2 hours, on chapters 3, 4, 6, 7, 8 and 9. One short answer is guaranteed from Ch 4; the other is never from Ch 7.</p>
        <p className="text-sm">
          <b>Short answers:</b> about 2 paragraphs; point form is fine if you use full sentences (a “list” question can just be a list). <b>Bring:</b> pencil + a spare, eraser, student card or government ID.
          <b> Scantron:</b> questions 51–60 are on the back, and there's no extra time to fill it in. Doors close 30 minutes after the start.
        </p>
        <p className="text-xs text-pencil">Format and logistics: midterm-information slides (pp. 3–7); the Ch 4 / not-Ch 7 short-answer rule is from your course notes. Everything below comes from the course slides; brand examples are illustrative.</p>
      </section>

      <section className="space-y-2">
        <h2 className="border-b-2 border-ink pb-1 text-[21px] font-extrabold">Your weakest concepts</h2>
        {weak.length === 0 && <p className="text-sm text-pencil">Not enough answers yet to rank — practise a little first.</p>}
        <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
          {weak.map((id) => {
            const c = conceptById.get(id)!;
            return (
              <div key={id} className="break-inside-avoid border-l-2 border-hl py-1 pl-3 text-[15px]">
                <p className="font-bold">{c.title} <span className="font-normal text-pencil">· Ch {c.chapter}</span></p>
                <p className="mt-1">{c.explain}</p>
                <ul className="mt-1 list-disc pl-4 text-xs">{c.terms.map((t) => <li key={t.term}><b>{t.term}:</b> {t.def}</li>)}</ul>
                <p className="mt-1 text-[10px] text-pencil">{c.src}</p>
              </div>
            );
          })}
        </div>
        {unseen.length > 0 && (
          <p className="text-sm">
            <b>Not studied yet ({unseen.length}):</b> {unseen.slice(0, 40).map((id) => conceptById.get(id)!.title).join(' · ')}{unseen.length > 40 ? ' …' : ''}
          </p>
        )}
      </section>

      {owed.length > 0 && (
        <section className="space-y-2">
          <h2 className="border-b-2 border-ink pb-1 text-[21px] font-extrabold">Mistakes still owed</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {owed.map((id) => {
              const q = mcqById.get(id)!;
              return (
                <li key={id} className="break-inside-avoid">
                  {q.q} <b className="text-tick">→ {q.options[q.answer]}</b>
                  <span className="text-xs text-pencil"> ({q.src})</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="border-b-2 border-ink pb-1 text-[21px] font-extrabold">Don't mix these up</h2>
        <ul className="grid gap-1.5 text-sm md:grid-cols-2 print:grid-cols-2">
          {content.confusables.map((c) => (
            <li key={c.id} className="break-inside-avoid"><b>{c.title}:</b> {c.tip}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="border-b-2 border-ink pb-1 text-[21px] font-extrabold">Ch 4 short answers (one is guaranteed)</h2>
        {ch4Sas.map((s) => (
          <div key={s.id} className="break-inside-avoid text-sm">
            <p className="font-semibold">{s.q}</p>
            <ul className="list-disc pl-5">{s.rubric.map((r) => <li key={r.point}>{r.point}</li>)}</ul>
            <p className="text-[10px] text-pencil">{s.src}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 text-[21px] font-extrabold">Key terms by chapter</h2>
        {content.chapters.map((ch) => (
          <div key={ch.id} className="space-y-1">
            <h3 className="font-bold">Ch {ch.id} {CHAPTER_SHORT[ch.id]}</h3>
            <div className="columns-1 gap-6 text-xs md:columns-2 print:columns-2">
              {ch.conceptIds.flatMap((cid) => conceptById.get(cid)!.terms.map((t) => (
                <p key={`${cid}-${t.term}`} className="mb-1 break-inside-avoid"><b>{t.term}</b> — {t.def}</p>
              )))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
