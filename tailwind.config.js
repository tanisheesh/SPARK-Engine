/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        spark: {
          bg:       '#0A0A0A',
          panel:    '#141414',
          elevated: '#1A1A1A',
          border:   '#2A2A2A',
          accent:   '#A9C08E',
          'accent-dim': '#7A9065',
          text:     '#F5F5F5',
          muted:    '#9A9A9A',
          faint:    '#6A6A6A',
        },
      },
    },
  },
  plugins: [],
}
