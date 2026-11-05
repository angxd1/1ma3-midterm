import { useMemo, useState } from 'react';
import type { ShortAnswer } from '../content/types';
import { checkRubric } from '../lib/keywords';
import { Source } from './ConceptPanel';
import { ChapterChip, tabStyle } from './ui';

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
    <div className="sheet space-y-4" style={tabStyle(sa.chapter)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ChapterChip ch={sa.chapter} />
        <span className="text-xs font-semibold text-ink">Short answer</span>
        <span className="text-xs text-pencil">{sa.type === 'application' ? 'Application' : 'Theory'}</span>
      </div>
      <p className="max-w-[68ch] font-serif text-[19px] leading-relaxed sm:text-[21px]">{sa.q}</p>
      <p className="text-[13px] text-pencil">Aim for about 2 paragraphs. Point form is fine if you write full sentences.</p>
      <textarea
        className="input min-h-48 font-serif text-[16px] leading-relaxed"
        value={text}
        disabled={checked}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(e.target.value);
        }}
        placeholder="Write your answer…"
      />
      <div className="flex items-center justify-between text-[13px] text-pencil">
        <span className="tabular-nums">{words} words</span>
        {checkable && !checked && <button className="btn-primary" disabled={words < 5} onClick={startCheck}>Check my answer</button>}
      </div>

      {checked && marks && (
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-semibold">Rubric points the keyword check found</h4>
            <ul className="space-y-2">
              {result.map((r, i) => (
                <li key={r.point} className={`border-l-2 py-1 pl-3 text-[15px] ${r.detected ? 'border-tick' : 'border-hl'}`}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      disabled={confirmed}
                      checked={marks[i]}
                      onChange={(e) => setMarks((m) => m!.map((v, j) => (j === i ? e.target.checked : v)))}
                    />
                    <span>
                      <b className={r.detected ? 'text-tick' : 'text-ink'}>{r.detected ? 'Found' : 'Looks missing'}:</b> {r.point}
                      {r.hits.length > 0 && <span className="block text-[13px] text-pencil">Matched: {r.hits.join(', ')}</span>}
                      {r.missing.length > 0 && <span className="block text-[13px] text-pencil">Look for: {r.missing.join(', ')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-pencil">Tick the points you think you earned. The keyword assist is only a hint, so you decide the final mark.</p>
          </div>
          <details open className="rounded-md bg-paper p-4">
            <summary className="cursor-pointer font-semibold">Model answer</summary>
            <div className="mt-2 max-w-[68ch] space-y-2 font-serif text-[16px] leading-relaxed">
              {sa.model.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </details>
          <div className="border-l-2 border-redpen pl-3 text-[15px]">
            <b className="text-redpen">Common mistakes</b>
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
            <p className="text-center text-[15px] font-semibold text-tick">Mark saved: {marks.filter(Boolean).length} / {marks.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
