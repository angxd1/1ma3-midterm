/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef6ff', 100: '#d9eaff', 400: '#4f9dff', 500: '#2f7cf6', 600: '#1f63d8', 700: '#1a4fae' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.98)' }, '100%': { transform: 'scale(1)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
      },
      animation: { pop: 'pop .18s ease-out', shake: 'shake .25s ease-in-out' },
    },
  },
  plugins: [],
};
