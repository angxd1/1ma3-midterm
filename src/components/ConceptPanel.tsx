import { useState } from 'react';
import type { Concept } from '../content/types';

export function Source({ src }: { src: string }) {
  return <span className="src" title="Where this comes from in the course materials">Source: {src}</span>;
}

/** Full concept explanation with an "Explain it differently" toggle. */
export function ConceptPanel({ concept, compact = false }: { concept: Concept; compact?: boolean }) {
  const [alt, setAlt] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={compact ? 'font-semibold' : 'text-[21px] font-extrabold leading-tight'}>{concept.title}</h3>
        <button className="text-[13px] font-semibold text-ink underline decoration-hl decoration-[3px] underline-offset-4" onClick={() => setAlt((v) => !v)}>
          {alt ? 'Show the original explanation' : 'Explain it differently'}
        </button>
      </div>
      <p className="max-w-[68ch] font-serif text-[17px] leading-[1.65]">{alt ? concept.alt : concept.explain}</p>
      {!compact && concept.terms.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {concept.terms.map((t) => (
            <div key={t.term}>
              <dt className="text-[15px] font-semibold"><span className="hl">{t.term}</span></dt>
              <dd className="mt-0.5 text-[15px] text-ink/85">{t.def}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="border-l-2 border-hl pl-3 text-[15px]">
        <p className="text-[13px] font-semibold text-pencil">Illustrative example</p>
        <p className="font-serif">{concept.example}</p>
      </div>
      <Source src={concept.src} />
    </div>
  );
}
