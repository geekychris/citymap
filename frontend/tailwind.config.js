/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#0b1220',
        panel2: '#111a2e',
        card: '#151f36',
        line: '#1e2a44',
        ink: '#e2e8f0',
        subink: '#94a3b8',
        accent: '#38bdf8',
        accent2: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'ui-sans-serif', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
