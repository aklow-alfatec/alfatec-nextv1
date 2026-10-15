import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        'line-2': v('line-2'),
        fg: v('text'),
        'fg-2': v('text-2'),
        'fg-3': v('text-3'),
        accent: v('accent'),
        'accent-fg': v('accent-fg'),
        positive: v('positive'),
        negative: v('negative'),
        info: v('info'),
        warning: v('warning'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { chip: '5px', control: '7px', card: '12px' },
      spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px' },
    },
  },
  plugins: [],
};
export default config;
