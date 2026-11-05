import { HlBar } from './ui';

export function ProgressBar({ value, label, tone = 'hl' }: { value: number; label: string; tone?: 'hl' | 'faint' | 'tick' }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[13px] text-pencil">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-ink">{pct}%</span>
      </div>
      <HlBar value={value} tone={tone} label={label} />
    </div>
  );
}
