/** Simple pen-stroke icons (24px, currentColor). */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const ICONS: Record<string, JSX.Element> = {
  home: <path {...P} d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9M10 19v-5h4v5" />,
  learn: <path {...P} d="M6 19c3-1 2-5 6-6s4-5 6-8M6 19a1.5 1.5 0 1 0 0-.01M18 5a1.5 1.5 0 1 0 0-.01" />,
  practice: <path {...P} d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" />,
  mock: <path {...P} d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 1.5M10 3h4" />,
  mistakes: <path {...P} d="M6 4h9l3 3v13H6zM9 11l6 6M15 11l-6 6M9 8h4" />,
  progress: <path {...P} d="M5 19V9M10 19V5M15 19v-7M20 19H3" />,
  settings: <path {...P} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12l2-1-1-3-2 .2-1.3-1.3.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2L6 7.2 4 7l-1 3 2 1v2l-2 1 1 3 2-.2 1.3 1.3-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.3-1.3 2 .2 1-3-2-1Z" />,
};

export function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
