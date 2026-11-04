import { useMemo, useState } from 'react';
import type { ShortAnswer } from '../content/types';
import { checkRubric } from '../lib/keywords';
import { Source } from './ConceptPanel';

/**
 * Short-answer practice: type → Check → keyword assist highlights detected/missing
 * rubric points → model answer + common mistakes → you confirm your own mark.
 */
export function ShortAnswerCard({
  sa,
  initial = '',
  onChange,
  onMarked,
  checkable = true,
}: {
  sa: ShortAnswer;
  initial?: string;
  onChange?: (text: string) => void;
  onMarked?: (score: number, outOf: number, text: string) => void;
  checkable?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [checked, setChecked] = useState(false);
  const [marks, setMarks] = useState<boolean[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const result = useMemo(() => (checked ? checkRubric(text, sa.rubric) : []), [checked, text, sa.rubric]);

  const startCheck = () => {
    const r = checkRubric(text, sa.rubric);
    setMarks(r.map((x) => x.detected));
    setChecked(true);
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="chip bg-slate-100 dark:bg-slate-800">Short answer · Ch {sa.chapter}</span>
        <span className="chip bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">{sa.type === 'application' ? 'Application' : 'Theory'}</span>
      </div>
      <p className="font-medium leading-relaxed">{sa.q}</p>
      <p className="text-xs text-slate-500">Aim for about 2 paragraphs. Point form is OK if written in full sentences.</p>
      <textarea
        className="input min-h-48 leading-relaxed"
        value={text}
        disabled={checked}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder="Write your answer…"
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{words} words</span>
        {checkable && !checked && <button className="btn-primary" disabled={words < 5} onClick={startCheck}>Check</button>}
      </div>

      {checked && marks && (
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-semibold">Keyword assist — rubric points</h4>
            <ul className="space-y-2">
              {result.map((r, i) => (
                <li key={r.point} className={`rounded-xl border p-3 text-sm ${r.detected ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      disabled={confirmed}
                      checked={marks[i]}
                      onChange={(e) => setMarks((m) => m!.map((v, j) => (j === i ? e.target.checked : v)))}
                    />
                    <span>
                      <b>{r.detected ? 'Detected' : 'Seems missing'}:</b> {r.point}
                      {r.hits.length > 0 && <span className="block text-xs text-slate-500">found: {r.hits.join(', ')}</span>}
                      {r.missing.length > 0 && <span className="block text-xs text-slate-500">look for: {r.missing.join(', ')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Tick the points you think you earned. The keyword assist is only a hint, so you decide the final mark.</p>
          </div>
          <details open className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <summary className="cursor-pointer font-semibold">Model answer</summary>
            <div className="mt-2 space-y-2 text-sm leading-relaxed">
              {sa.model.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </details>
          <div className="rounded-xl bg-rose-50 p-3 text-sm dark:bg-rose-950/30">
            <b>Common mistakes</b>
            <ul className="mt-1 list-disc pl-5">{sa.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
          <Source src={sa.src} />
          {!confirmed ? (
            <button
              className="btn-primary w-full"
              onClick={() => {
                setConfirmed(true);
                onMarked?.(marks.filter(Boolean).length, marks.length, text);
              }}
            >
              Confirm my mark: {marks.filter(Boolean).length} / {marks.length}
            </button>
          ) : (
            <p className="text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">Saved: {marks.filter(Boolean).length} / {marks.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
