import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ChapterId } from '../content/types';
import { CHAPTER_SHORT } from '../lib/content';

/** Sticky-tab colour per chapter (see DESIGN_PLAN.md). */
export const TAB: Record<ChapterId, string> = { 3: '#F4A6A0', 4: '#8EC5E8', 6: '#9BD8B5', 7: '#C3B1E8', 8: '#F7C08A', 9: '#C9DB7A' };
export const tabStyle = (ch: ChapterId) => ({ '--tab': TAB[ch] }) as CSSProperties;

/**
 * Progress drawn as a highlighter stroke over a pencil rule.
 * tone: "hl" (yellow, default), "faint" (lighter yellow), "tick" (green, for mastery) or "redpen".
 */
export function HlBar({ value, tone = 'hl', label, thick = false }: { value: number; tone?: 'hl' | 'faint' | 'tick' | 'redpen'; label?: string; thick?: boolean }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const fill = { hl: 'bg-hl', faint: 'bg-hl/45 dark:bg-hl/60', tick: 'bg-tick/80', redpen: 'bg-redpen/80' }[tone];
  return (
    <div className={`relative ${thick ? 'h-3.5' : 'h-2.5'}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
      <div
        className={`absolute inset-y-0 left-0 ${fill} transition-[width] duration-500`}
        style={{ width: `${pct}%`, borderRadius: '2px 7px 3px 6px', clipPath: pct ? 'polygon(1.5% 8%, 100% 0, 98.5% 92%, 0 100%)' : undefined }}
      />
    </div>
  );
}

/** Chapter switcher drawn as coloured sticky tabs along the top of a page. */
export function ChapterTabs({ active, to, onSelect, all }: { active: ChapterId | 'all' | null; to?: (ch: ChapterId) => string; onSelect?: (ch: ChapterId | 'all') => void; all?: boolean }) {
  const chs = [3, 4, 6, 7, 8, 9] as ChapterId[];
  const base = 'shrink-0 rounded-t-md border-x border-t px-3 pb-1.5 pt-2 text-sm font-semibold transition';
  const cls = (on: boolean) => `${base} ${on ? 'border-rule bg-sheet text-ink -mb-px' : 'border-transparent text-ink/70 hover:text-ink'}`;
  const tabBar = (ch: ChapterId) => <span className="mb-1 block h-1.5 w-full rounded-sm" style={{ background: TAB[ch] }} />;
  const item = (ch: ChapterId, children: ReactNode) =>
    to ? (
      <Link key={ch} to={to(ch)} className={cls(active === ch)} aria-current={active === ch ? 'page' : undefined} ref={active === ch ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}>
        {children}
      </Link>
    ) : (
      <button key={ch} onClick={() => onSelect?.(ch)} className={cls(active === ch)} aria-pressed={active === ch}>
        {children}
      </button>
    );
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-rule" role="tablist">
      {all && onSelect && (
        <button onClick={() => onSelect('all')} className={cls(active === 'all')} aria-pressed={active === 'all'}>
          <span className="mb-1 block h-1.5 w-full rounded-sm bg-ink/25" />
          All
        </button>
      )}
      {chs.map((ch) =>
        item(
          ch,
          <>
            {tabBar(ch)}
            <span className="whitespace-nowrap">Ch {ch}<span className="hidden font-normal text-pencil sm:inline"> {CHAPTER_SHORT[ch]}</span></span>
          </>,
        ),
      )}
    </div>
  );
}

/** Small chapter marker: a dot of the chapter's tab colour + "Ch n". */
export function ChapterChip({ ch, title }: { ch: ChapterId; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pencil">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TAB[ch] }} />
      Ch {ch}{title ? <span className="font-normal">{title}</span> : null}
    </span>
  );
}
