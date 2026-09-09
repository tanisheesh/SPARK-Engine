/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',

        line: 'var(--line)',
        'line-subtle': 'var(--line-subtle)',

        // Three text weights, named for their job. There is no fourth.
        ink: 'var(--text)',
        muted: 'var(--text-2)',
        faint: 'var(--text-3)',

        accent: {
          DEFAULT: 'var(--accent)',
          hi: 'var(--accent-hi)',
          lo: 'var(--accent-lo)',
          ink: 'var(--accent-ink)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
        },

        positive: 'var(--positive)',
        negative: 'var(--negative)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        idle: 'var(--idle)',
      },

      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r-md)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
      },

      boxShadow: {
        pop: 'var(--shadow-pop)',
        overlay: 'var(--shadow-overlay)',
        none: 'none',
      },

      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      /* A working tool's scale: nothing enormous, nothing illegible.
         Metadata bottoms out at 11px, body sits at 13. */
      fontSize: {
        '2xs': ['11px', { lineHeight: '15px' }],
        xs: ['11.5px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '17px' }],
        base: ['13px', { lineHeight: '20px' }],
        md: ['13.5px', { lineHeight: '21px' }],
        lg: ['15px', { lineHeight: '22px', letterSpacing: '-0.008em' }],
        xl: ['17px', { lineHeight: '24px', letterSpacing: '-0.011em' }],
        '2xl': ['21px', { lineHeight: '28px', letterSpacing: '-0.016em' }],
        '3xl': ['26px', { lineHeight: '32px', letterSpacing: '-0.021em' }],
        // Prose inside an answer wants more air than UI chrome.
        prose: ['14px', { lineHeight: '23px' }],
      },

      spacing: {
        // The 4/8 rhythm, with the in-between steps the layouts actually use.
        4.5: '18px',
        13: '52px',
        18: '72px',
      },

      transitionTimingFunction: {
        out: 'var(--ease)',
      },
      transitionDuration: {
        1: 'var(--dur-1)',
        2: 'var(--dur-2)',
        3: 'var(--dur-3)',
      },
    },
  },
  plugins: [],
};
