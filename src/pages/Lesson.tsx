import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { content, conceptById, CHAPTER_SHORT } from '../lib/content';
import { ConceptPanel } from '../components/ConceptPanel';
import { ChapterChip, HlBar, tabStyle } from '../components/ui';
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
      <div className="flex items-center justify-between text-[15px]">
        <Link to={`/learn/${concept.chapter}`} className="text-pencil hover:text-ink">Back to the Ch {concept.chapter} path</Link>
        <span className="text-pencil">Concept {idx + 1} of {chapter.conceptIds.length}</span>
      </div>
      <HlBar value={step / (recall.length + 1)} label="Lesson progress" />

      {step === 0 && (
        <div className="sheet space-y-5" style={tabStyle(concept.chapter)}>
          <ChapterChip ch={concept.chapter} title={CHAPTER_SHORT[concept.chapter]} />
          <ConceptPanel concept={concept} />
          <button className="btn-primary w-full" onClick={() => setStep(1)}>Test my recall ({recall.length} questions)</button>
        </div>
      )}

      {step >= 1 && step <= recall.length && (
        <McqCard
          key={recall[step - 1].id}
          q={recall[step - 1]}
          header={<span className="text-xs font-semibold text-ink">Recall question {step} of {recall.length}</span>}
          onAnswered={(r) => {
            if (r.correct) setScore((s) => s + 1);
            const q = recall[step - 1];
            record({ questionId: q.id, conceptIds: q.concepts, correct: r.correct, confidence: r.confidence, mode: 'path', meta: { ms: r.ms, chosen: r.chosen } });
          }}
          onNext={() => (step === recall.length ? finish() : setStep(step + 1))}
          nextLabel={step === recall.length ? 'Finish lesson' : 'Next question'}
        />
      )}

      {step === recall.length + 1 && (
        <div className="sheet space-y-4 text-center" style={tabStyle(concept.chapter)}>
          <p className="text-[26px] font-extrabold leading-tight">Lesson done</p>
          <p className="text-[17px]">You got <span className="hl font-semibold">{score} of {recall.length}</span> recall questions right.</p>
          <p className="text-[15px] text-pencil">This concept now counts as seen. Answer {recall.length > 0 ? 'more of its questions' : 'its questions'} in practice to master it.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-ghost" onClick={() => { setStep(0); setScore(0); }}>Review again</button>
            {nextId ? (
              <button className="btn-primary" onClick={() => { setStep(0); setScore(0); nav(`/lesson/${nextId}`); }}>Next concept</button>
            ) : (
              <Link className="btn-primary" to={`/learn/${concept.chapter}`}>Back to the path</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
