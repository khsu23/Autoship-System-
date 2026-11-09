import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { chewy: { blue: '#1754a6', ink: '#152033', pale: '#edf5ff', yellow: '#ffcb05', mint: '#e8f6ef' } },
      boxShadow: { card: '0 8px 25px rgba(21, 32, 51, 0.08)' },
    },
  },
  plugins: [],
} satisfies Config;
