import { useState } from 'react';
import type { Concept } from '../content/types';

export function Source({ src }: { src: string }) {
  return <span className="src" title="Source">Source: {src}</span>;
}

/** Full concept explanation with an "Explain it differently" toggle. */
export function ConceptPanel({ concept, compact = false }: { concept: Concept; compact?: boolean }) {
  const [alt, setAlt] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className={compact ? 'font-semibold' : 'text-lg font-bold'}>{concept.title}</h3>
        <button className="chip bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-700/20 dark:text-brand-100" onClick={() => setAlt((v) => !v)}>
          {alt ? 'Show the original explanation' : 'Explain it differently'}
        </button>
      </div>
      <p className="leading-relaxed text-slate-700 dark:text-slate-300">{alt ? concept.alt : concept.explain}</p>
      {!compact && concept.terms.length > 0 && (
        <dl className="grid gap-2 sm:grid-cols-2">
          {concept.terms.map((t) => (
            <div key={t.term} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <dt className="text-sm font-semibold">{t.term}</dt>
              <dd className="text-sm text-slate-600 dark:text-slate-300">{t.def}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        💡 {concept.example}
      </p>
      <Source src={concept.src} />
    </div>
  );
}
