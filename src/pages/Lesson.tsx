import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { content, conceptById } from '../lib/content';
import { ConceptPanel } from '../components/ConceptPanel';
import { McqCard } from '../components/McqCard';
import { record } from '../lib/store';

export default function Lesson() {
  const { id = '' } = useParams();
  const concept = conceptById.get(id);
  const nav = useNavigate();
  const recall = useMemo(() => content.mcqs.filter((q) => q.kind === 'recall' && q.concepts[0] === id), [id]);
  const [step, setStep] = useState(0); // 0 = lesson, 1..n = recall questions, n+1 = done
  const [score, setScore] = useState(0);

  if (!concept) return <p>Concept not found. <Link className="underline" to="/learn">Back to the path</Link></p>;
  const chapter = content.chapters.find((c) => c.id === concept.chapter)!;
  const idx = chapter.conceptIds.indexOf(id);
  const nextId = chapter.conceptIds[idx + 1];

  const finish = () => {
    record({ questionId: `lesson:${id}`, conceptIds: [id], correct: true, confidence: null, mode: 'lesson', meta: { recallScore: score, recallTotal: recall.length } });
    setStep(recall.length + 1);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm">
        <Link to={`/learn/${concept.chapter}`} className="text-brand-600 hover:underline">← Chapter {concept.chapter} path</Link>
        <span className="text-slate-500">Concept {idx + 1} of {chapter.conceptIds.length}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: recall.length + 1 }, (_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="card space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Lesson</p>
          <ConceptPanel concept={concept} />
          <button className="btn-primary w-full" onClick={() => setStep(1)}>Test my recall ({recall.length} questions)</button>
        </div>
      )}

      {step >= 1 && step <= recall.length && (
        <McqCard
          key={recall[step - 1].id}
          q={recall[step - 1]}
          header={<span className="chip bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100">Recall {step}/{recall.length}</span>}
          onAnswered={(r) => {
            if (r.correct) setScore((s) => s + 1);
            const q = recall[step - 1];
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'path', meta: { ms: r.ms, chosen: r.chosen } });
          }}
          onNext={() => (step === recall.length ? finish() : setStep(step + 1))}
          nextLabel={step === recall.length ? 'Finish lesson' : 'Next'}
        />
      )}

      {step === recall.length + 1 && (
        <div className="card animate-pop space-y-4 text-center">
          <p className="text-4xl">{score === recall.length ? '🎉' : '👍'}</p>
          <p className="text-lg font-bold">Lesson complete — {score}/{recall.length} on recall</p>
          <p className="text-sm text-slate-500">This concept now counts toward your coverage. Keep answering its questions to master it.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-ghost" onClick={() => { setStep(0); setScore(0); }}>Review again</button>
            {nextId ? (
              <button className="btn-primary" onClick={() => { setStep(0); setScore(0); nav(`/lesson/${nextId}`); }}>Next concept →</button>
            ) : (
              <Link className="btn-primary" to={`/learn/${concept.chapter}`}>Back to path</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
