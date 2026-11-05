/** @type {import('tailwindcss').Config} */
// Colours that flip between light and dark come from CSS variables in src/index.css
// ("study notes" tokens: paper, sheet, ink, pencil, rule, highlighter, red pen, tick).
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'serif'],
      },
      colors: {
        paper: v('paper'),
        sheet: v('sheet'),
        ink: v('ink'),
        pencil: v('pencil'),
        rule: v('rule'),
        hl: v('hl'),
        redpen: v('redpen'),
        tick: v('tick'),
        tab: { 3: '#F4A6A0', 4: '#8EC5E8', 6: '#9BD8B5', 7: '#C3B1E8', 8: '#F7C08A', 9: '#C9DB7A' },
        // "brand" is ink-blue and flips in dark mode so text links stay readable.
        brand: { 50: v('brand-50'), 100: v('brand-100'), 400: v('brand-400'), 500: v('brand-500'), 600: v('brand-600'), 700: v('brand-700') },
        // Navy-tinted neutrals so greys sit with the ink.
        slate: { 50: '#F6F7F9', 100: '#EDEFF3', 200: '#E1E4EA', 300: '#C9CED8', 400: '#99A1B3', 500: '#5E6779', 600: '#4A5366', 700: '#353E52', 800: '#262C3A', 900: '#1C212D', 950: '#141821' },
        // Tick green, red pen and highlighter scales replace the stock ones.
        emerald: { 50: '#EAF6EF', 100: '#D3EEDD', 200: '#A9DDBE', 300: '#7CC89E', 400: '#4CB07C', 500: '#2E9461', 600: '#1E7A4C', 700: '#17643E', 800: '#124E31', 900: '#0D3A25', 950: '#08261A' },
        rose: { 50: '#FCEEEF', 100: '#F8D9DB', 200: '#F0B3B7', 300: '#E68990', 400: '#DB5E67', 500: '#CF3F4A', 600: '#C42F3B', 700: '#A1242F', 800: '#7E1C25', 900: '#5C151B', 950: '#3A0D11' },
        amber: { 50: '#FFFBE0', 100: '#FFF4B3', 200: '#FFEC85', 300: '#FFE14D', 400: '#F5D02E', 500: '#E3B91A', 600: '#B88F0E', 700: '#8A6A0B', 800: '#5E4808', 900: '#3D2F06', 950: '#261D04' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.98)' }, '100%': { transform: 'scale(1)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
        swipe: { '0%': { backgroundSize: '0% 100%' }, '100%': { backgroundSize: '100% 100%' } },
        strike: { '0%': { backgroundSize: '0% 2px' }, '100%': { backgroundSize: '100% 2px' } },
        stamp: { '0%': { transform: 'scale(1.5) rotate(-14deg)' }, '60%': { transform: 'scale(.95) rotate(-8deg)' }, '100%': { transform: 'scale(1) rotate(-8deg)' } },
        slidein: { '0%': { transform: 'translateY(12px)' }, '100%': { transform: 'translateY(0)' } },
      },
      animation: {
        pop: 'pop .18s ease-out',
        shake: 'shake .25s ease-in-out',
        swipe: 'swipe .26s ease-out both',
        strike: 'strike .2s ease-out both',
        stamp: 'stamp .35s ease-out both',
        slidein: 'slidein .2s ease-out both',
      },
    },
  },
  plugins: [],
};
