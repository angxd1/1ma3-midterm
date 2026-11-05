import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const GO_KEYS: [string, string, string][] = [
  ['h', '/', 'Home'],
  ['l', '/learn', 'Learn path'],
  ['p', '/practice', 'Practice (Version A)'],
  ['m', '/mock', 'Mock midterm (Version B)'],
  ['x', '/mistakes', 'Mistake notebook'],
  ['r', '/progress', 'Progress, plan & badges'],
  ['z', '/lightning', 'Lightning round'],
  ['f', '/flashcards', 'Flashcards'],
  ['c', '/confusables', 'Confusable pairs'],
  ['n', '/last-night', 'Last-night sheet'],
  ['s', '/settings', 'Settings'],
];

const SCREENS: [string, string][] = [
  ['1–5', 'Choose an answer'],
  ['S / U / G', 'Confidence: sure, unsure, guessing'],
  ['Enter', 'Check, then next'],
  ['E', 'Explore the concept after a wrong answer'],
  ['F, ← →', 'Mock: flag, previous or next question'],
  ['Space, 1 2 3', 'Flashcards: flip, then again, good or easy'],
];

/** Global keyboard shortcuts: "g" then a letter to jump anywhere, "?" for help, Esc to close. */
export function Shortcuts() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'g') {
        pendingG.current = Date.now();
        return;
      }
      if (Date.now() - pendingG.current < 1200) {
        const hit = GO_KEYS.find(([k]) => k === e.key.toLowerCase());
        pendingG.current = 0;
        if (hit) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setOpen(false);
          nav(hit[1]);
        }
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [nav]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden" onClick={() => setOpen(false)}>
      <div className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Keyboard shortcuts</h2>
          <button className="text-sm text-pencil" onClick={() => setOpen(false)}>Esc</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-pencil">Go to (press g, then…)</p>
            <ul className="space-y-1 text-sm">{GO_KEYS.map(([k, , label]) => <li key={k}><kbd className="mr-2 mr-2">g {k}</kbd>{label}</li>)}</ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-pencil">On a question</p>
            <ul className="space-y-1 text-sm">{SCREENS.map(([k, label]) => <li key={k}><kbd className="mr-2 mr-2">{k}</kbd>{label}</li>)}</ul>
            <p className="mt-3 text-xs text-pencil">Press ? anywhere to toggle this panel.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
